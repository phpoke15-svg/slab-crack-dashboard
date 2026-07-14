import "server-only"
import {
  lookupCardById,
  lookupCardByPokemonId,
  searchCatalogCards,
  searchHitToPlaceholder,
  type CardSearchHit,
} from "@/lib/card-lookup"
import {
  cleanNumber,
  extractGeminiAnswerText,
  parseDetectedJson,
  thinkingConfigForModel,
  type DetectedCard,
  type GeminiGenerateResponse,
} from "@/lib/slabcrack/identify-parse"
import { normalizeCardEntry, type MockCardEntry } from "@/lib/slab-data"

export type { DetectedCard }

export type IdentifyCardResult = {
  ok: true
  detected: DetectedCard
  query: string
  hit: CardSearchHit | null
  candidates: CardSearchHit[]
  card: MockCardEntry | null
  source: "gemini" | "openai"
}

const IDENTIFY_PROMPT = [
  "Identify the Pokemon trading card in this photo.",
  "Return JSON with keys:",
  'cardName (string, pokemon name + stage like "Umbreon ex"),',
  "setName (string, English set name if visible, else empty string),",
  'cardNumber (string, collector number like "161" or "161/131", else empty),',
  "confidence (number 0-1),",
  "notes (short string).",
  "Prefer the English name when bilingual. Ignore PSA slab labels for the card identity.",
  "If unsure, still guess the most likely cardName + cardNumber and lower confidence.",
].join(" ")

function buildSearchQuery(detected: DetectedCard): string {
  const number = cleanNumber(detected.cardNumber)
  const name = detected.cardName.trim()
  const setName = detected.setName.trim()
  if (name && number) return `${name} ${number}`
  if (name && setName) return `${name} ${setName}`
  if (name) return name
  if (number && setName) return `${setName} ${number}`
  return number || setName
}

function scoreHit(hit: CardSearchHit, detected: DetectedCard): number {
  const name = detected.cardName.toLowerCase()
  const setName = detected.setName.toLowerCase()
  const number = cleanNumber(detected.cardNumber).toLowerCase()
  const hitName = hit.cardName.toLowerCase()
  const hitSet = hit.setName.toLowerCase()
  const hitNum = (hit.cardNumber.split("/")[0] ?? "").toLowerCase()

  let score = 0
  if (number && hitNum === number) score += 50
  else if (number && hitNum.includes(number)) score += 20

  if (name && hitName.includes(name)) score += 35
  else if (name) {
    const first = name.split(/\s+/)[0] ?? ""
    if (first && hitName.includes(first)) score += 15
  }

  if (setName && hitSet.includes(setName)) score += 20
  else if (setName) {
    const token = setName.split(/\s+/).find((t) => t.length > 3)
    if (token && hitSet.includes(token.toLowerCase())) score += 10
  }

  return score
}

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

class GeminiOverloadedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GeminiOverloadedError"
  }
}

type GeminiRequestMode = "preferred" | "more-tokens"

function buildGenerationConfig(model: string, mode: GeminiRequestMode) {
  const thinking = thinkingConfigForModel(model)

  return {
    responseMimeType: "application/json",
    // Thinking tokens count against maxOutputTokens — keep headroom for JSON.
    maxOutputTokens: mode === "more-tokens" ? 8192 : 2048,
    temperature: 0,
    ...(thinking ? { thinkingConfig: thinking } : {}),
  }
}

async function detectWithGemini(imageDataUrl: string): Promise<DetectedCard> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.")
  }

  const configured = process.env.GEMINI_VISION_MODEL?.trim()
  // Prefer paid Gemini 3.5 Flash. Skip aliases that share the same quota on 429.
  const models = [configured, "gemini-3.5-flash", "gemini-2.5-flash"].filter(
    (m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i,
  )

  const { mimeType, base64 } = splitDataUrl(imageDataUrl)
  let lastError = "Gemini vision failed."
  let sawOverload = false

  for (const model of models) {
    const modes: GeminiRequestMode[] = ["preferred", "more-tokens"]

    for (const mode of modes) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
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
                  { text: IDENTIFY_PROMPT },
                  {
                    inlineData: {
                      mimeType,
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: buildGenerationConfig(model, mode),
          }),
        })

        if (response.status === 429 || response.status === 503) {
          sawOverload = true
          lastError = `Gemini vision overloaded (${response.status}) on ${model}`
          await sleep(1200 * (attempt + 1))
          continue
        }

        if (!response.ok) {
          const body = await response.text().catch(() => "")
          lastError = `Gemini vision failed (${response.status}) on ${model}: ${body.slice(0, 280)}`
          console.warn("[slabcrack-identify]", lastError)

          // Model id missing / unavailable for this key → try the next candidate.
          if (response.status === 404 || /no longer available|not found|not supported/i.test(body)) {
            break
          }
          // Invalid thinkingConfig → try next mode / model.
          if (response.status === 400 && /thinking/i.test(body)) {
            break
          }
          throw new Error(lastError)
        }

        const json = (await response.json()) as GeminiGenerateResponse
        const { text: raw, finishReason, blockReason } = extractGeminiAnswerText(json)

        if (blockReason) {
          lastError = `Gemini blocked the photo (${blockReason}) on ${model}.`
          console.warn("[slabcrack-identify]", lastError)
          break
        }

        if (!raw) {
          lastError = `Gemini returned an empty identification from ${model}${
            finishReason ? ` (${finishReason})` : ""
          }.`
          console.warn("[slabcrack-identify]", lastError, JSON.stringify(json).slice(0, 400))
          // Empty / MAX_TOKENS usually means thinking ate the output budget — try next mode.
          break
        }

        try {
          return parseDetectedJson(raw, "Gemini")
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Gemini JSON parse failed."
          console.warn("[slabcrack-identify]", lastError, raw.slice(0, 240))
          break
        }
      }

      // Don't keep retrying modes once the account is rate-limited.
      if (sawOverload) break
    }

    // 429/503 is usually account-wide — don't burn more Gemini models.
    if (sawOverload) break
  }

  if (sawOverload) {
    throw new GeminiOverloadedError(
      `${lastError}. Wait a few seconds and try again, or we'll use OpenAI fallback if configured.`,
    )
  }

  throw new Error(lastError)
}

async function detectWithOpenAI(imageDataUrl: string): Promise<DetectedCard> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.")
  }

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
          content: "You identify Pokemon TCG trading cards from photos. Return strict JSON only.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: IDENTIFY_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
                detail: "low",
              },
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`OpenAI vision failed (${response.status}): ${body.slice(0, 200)}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = json.choices?.[0]?.message?.content?.trim()
  if (!raw) throw new Error("OpenAI returned an empty identification.")
  return parseDetectedJson(raw, "OpenAI")
}

async function detectCard(
  imageDataUrl: string,
): Promise<{ detected: DetectedCard; source: "gemini" | "openai" }> {
  const prefer = (process.env.SLABCRACK_VISION_PROVIDER?.trim() || "auto").toLowerCase()
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim())
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim())

  if (prefer === "openai") {
    if (!hasOpenAI) throw new Error("OPENAI_API_KEY is not configured.")
    return { detected: await detectWithOpenAI(imageDataUrl), source: "openai" }
  }

  if (prefer === "gemini") {
    if (!hasGemini) throw new Error("GEMINI_API_KEY is not configured.")
    try {
      return { detected: await detectWithGemini(imageDataUrl), source: "gemini" }
    } catch (error) {
      // Prefer Gemini, but don't leave Scan broken when OpenAI can finish the job.
      if (hasOpenAI) {
        console.warn(
          "[slabcrack-identify] Gemini failed — falling back to OpenAI:",
          error instanceof Error ? error.message : error,
        )
        return { detected: await detectWithOpenAI(imageDataUrl), source: "openai" }
      }
      throw error
    }
  }

  // auto: Gemini first, then OpenAI on any Gemini failure when both are configured.
  if (hasGemini) {
    try {
      return { detected: await detectWithGemini(imageDataUrl), source: "gemini" }
    } catch (error) {
      if (!hasOpenAI) throw error
      console.warn(
        "[slabcrack-identify]",
        error instanceof GeminiOverloadedError
          ? "Gemini overloaded — falling back to OpenAI"
          : "Gemini failed — falling back to OpenAI:",
        error instanceof Error ? error.message : error,
      )
    }
  }

  if (hasOpenAI) {
    return { detected: await detectWithOpenAI(imageDataUrl), source: "openai" }
  }

  throw new Error(
    "No vision API key configured. Add GEMINI_API_KEY (paid Gemini 3.5 recommended) in Vercel env.",
  )
}

async function priceHit(hit: CardSearchHit): Promise<MockCardEntry> {
  if (hit.id.startsWith("pc-")) {
    const priced = await lookupCardById(hit.id)
    return priced ?? searchHitToPlaceholder(hit)
  }

  const priced = await lookupCardByPokemonId(hit.pokemonTcgId, {
    cardName: hit.cardName,
    setName: hit.setName,
    cardNumber: hit.cardNumber,
    imageUrl: hit.imageUrl || undefined,
    rarity: hit.rarity,
  })
  return priced ?? searchHitToPlaceholder(hit)
}

/**
 * Vision-identify a card photo, then resolve live SlabCrack/SlabLab pricing for the best match.
 */
export async function identifyCardFromImage(imageDataUrl: string): Promise<IdentifyCardResult> {
  if (!imageDataUrl.startsWith("data:image/")) {
    throw new Error("Expected a data:image URL from the camera capture.")
  }

  if (imageDataUrl.length > 4_500_000) {
    throw new Error("Photo is too large. Retake closer or use a smaller image.")
  }

  const { detected, source } = await detectCard(imageDataUrl)
  const query = buildSearchQuery(detected)
  const candidates = await searchCatalogCards(query, 8)
  const ranked = [...candidates].sort(
    (a, b) => scoreHit(b, detected) - scoreHit(a, detected),
  )
  const hit = ranked[0] ?? null
  const card = hit ? normalizeCardEntry(await priceHit(hit)) : null

  return {
    ok: true,
    detected,
    query,
    hit,
    candidates: ranked,
    card,
    source,
  }
}
