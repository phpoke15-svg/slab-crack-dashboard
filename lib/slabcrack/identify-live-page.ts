import "server-only"
import { matchDetectedCard } from "@/lib/slabcrack/identify-card"
import {
  parseLivePageCardsJson,
  type LivePageDetectedCard,
} from "@/lib/slabcrack/identify-live-page-parse"
import {
  extractGeminiAnswerText,
  thinkingConfigForModel,
  type GeminiGenerateResponse,
} from "@/lib/slabcrack/identify-parse"
import type { CardSearchHit } from "@/lib/card-lookup"
import type { MockCardEntry } from "@/lib/slab-data"

export type LivePagePricedCard = {
  box: { x: number; y: number; w: number; h: number; confidence: number }
  detected: {
    cardName: string
    setName: string
    cardNumber: string
    confidence: number
  }
  card: MockCardEntry | null
  hit: CardSearchHit | null
  matchScore: number
  pricingSource: "local" | "live" | "none"
  needsLiveRefresh: boolean
  error?: string
}

export type IdentifyLivePageResult = {
  ok: true
  cards: LivePagePricedCard[]
  source: "gemini" | "openai"
}

const LIVE_PAGE_PROMPT = [
  "You are looking at a photo that may contain multiple Pokemon TCG cards (binder page, table, or hand).",
  "Find every visible Pokemon card (1–9).",
  'Return JSON only: {"cards":[{"x":0,"y":0,"w":0,"h":0,"confidence":0,"cardName":"","setName":"","cardNumber":""}]}',
  "x,y = top-left of each card as fractions of image width/height (0–1).",
  "w,h = box size as fractions of image width/height (0–1). Tight boxes on the card only.",
  "cardName like \"Umbreon ex\"; setName English or \"\"; cardNumber like \"161\" or \"161/131\" or \"\".",
  "Prefer English names. Ignore binder rings, empty sleeves, and non-card rectangles.",
  "Guess if unsure and lower confidence.",
].join(" ")

function splitDataUrl(imageDataUrl: string): { mimeType: string; base64: string } {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) {
    throw new Error("Expected a data:image base64 URL from the camera capture.")
  }
  return { mimeType: match[1]!, base64: match[2]! }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function buildGenerationConfig(model: string) {
  const thinking = thinkingConfigForModel(model)
  return {
    responseMimeType: "application/json",
    maxOutputTokens: 4096,
    temperature: 0,
    ...(thinking ? { thinkingConfig: thinking } : {}),
  }
}

async function detectLivePageWithGemini(imageDataUrl: string): Promise<LivePageDetectedCard[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.")

  const configured = process.env.GEMINI_VISION_MODEL?.trim()
  const models = [configured, "gemini-2.5-flash", "gemini-3.5-flash"].filter(
    (m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i,
  )
  const { mimeType, base64 } = splitDataUrl(imageDataUrl)
  let lastError = "Gemini live page detection failed."

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: LIVE_PAGE_PROMPT },
                { inlineData: { mimeType, data: base64 } },
              ],
            },
          ],
          generationConfig: buildGenerationConfig(model),
        }),
      })

      if (response.status === 429 || response.status === 503) {
        lastError = `Gemini live page overloaded (${response.status}) on ${model}`
        await sleep(500 * (attempt + 1))
        continue
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "")
        lastError = `Gemini live page failed (${response.status}) on ${model}: ${body.slice(0, 280)}`
        if (response.status === 404 || /no longer available|not found|not supported/i.test(body)) {
          break
        }
        throw new Error(lastError)
      }

      const json = (await response.json()) as GeminiGenerateResponse
      const { text: raw, blockReason } = extractGeminiAnswerText(json)
      if (blockReason) {
        lastError = `Gemini blocked the photo (${blockReason}) on ${model}.`
        break
      }
      if (!raw) {
        lastError = `Gemini returned empty live page result from ${model}.`
        break
      }
      return parseLivePageCardsJson(raw, "Gemini")
    }
  }

  throw new Error(lastError)
}

async function detectLivePageWithOpenAI(imageDataUrl: string): Promise<LivePageDetectedCard[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.")

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You locate and identify Pokemon TCG cards in photos. Return tight boxes + identity as JSON.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: LIVE_PAGE_PROMPT },
            { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`OpenAI live page failed (${response.status}): ${body.slice(0, 200)}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = json.choices?.[0]?.message?.content?.trim()
  if (!raw) throw new Error("OpenAI returned empty live page result.")
  return parseLivePageCardsJson(raw, "OpenAI")
}

async function detectLivePageCards(
  imageDataUrl: string,
): Promise<{ cards: LivePageDetectedCard[]; source: "gemini" | "openai" }> {
  const prefer = (process.env.SLABCRACK_VISION_PROVIDER?.trim() || "auto").toLowerCase()
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim())
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim())

  if (!hasGemini && !hasOpenAI) {
    throw new Error("No vision API key configured. Add GEMINI_API_KEY in Vercel env.")
  }

  if (prefer === "openai" || (!hasGemini && hasOpenAI)) {
    return { cards: await detectLivePageWithOpenAI(imageDataUrl), source: "openai" }
  }

  try {
    return { cards: await detectLivePageWithGemini(imageDataUrl), source: "gemini" }
  } catch (error) {
    if (hasOpenAI) {
      console.warn(
        "[slabcrack-live-page] Gemini failed — falling back to OpenAI:",
        error instanceof Error ? error.message : error,
      )
      return { cards: await detectLivePageWithOpenAI(imageDataUrl), source: "openai" }
    }
    throw error
  }
}

async function mapPool<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>) {
  const out = new Array<R>(items.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor
        cursor += 1
        out[i] = await worker(items[i]!, i)
      }
    }),
  )
  return out
}

/**
 * One camera frame → Gemini identifies every card + box → catalog/PriceCharting prices each.
 */
export async function identifyLivePage(imageDataUrl: string): Promise<IdentifyLivePageResult> {
  if (!imageDataUrl.startsWith("data:image/")) {
    throw new Error("Expected a data:image URL from the camera capture.")
  }
  if (imageDataUrl.length > 4_500_000) {
    throw new Error("Photo is too large. Retake closer or use a smaller image.")
  }

  const started = Date.now()
  const { cards: detectedCards, source } = await detectLivePageCards(imageDataUrl)
  console.warn(
    `[slabcrack-live-page] vision source=${source} cards=${detectedCards.length} in ${Date.now() - started}ms`,
  )

  if (!detectedCards.length) {
    return { ok: true, cards: [], source }
  }

  const priced = await mapPool(detectedCards, 3, async (detected) => {
    const box = {
      x: detected.x,
      y: detected.y,
      w: detected.w,
      h: detected.h,
      confidence: detected.confidence,
    }
    const identity = {
      cardName: detected.cardName,
      setName: detected.setName,
      cardNumber: detected.cardNumber,
      confidence: detected.confidence,
    }

    try {
      const match = await matchDetectedCard(identity, source)
      return {
        box,
        detected: identity,
        card: match.card,
        hit: match.hit,
        matchScore: match.matchScore,
        pricingSource: match.pricingSource,
        needsLiveRefresh: match.needsLiveRefresh,
      } satisfies LivePagePricedCard
    } catch (error) {
      return {
        box,
        detected: identity,
        card: null,
        hit: null,
        matchScore: 0,
        pricingSource: "none",
        needsLiveRefresh: false,
        error: error instanceof Error ? error.message : "Match/price failed",
      } satisfies LivePagePricedCard
    }
  })

  console.warn(
    `[slabcrack-live-page] priced ${priced.filter((c) => c.card).length}/${priced.length} in ${Date.now() - started}ms`,
  )

  return { ok: true, cards: priced, source }
}
