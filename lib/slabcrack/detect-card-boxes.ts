import "server-only"
import {
  parseCardBoxesJson,
  type DetectedCardBox,
} from "@/lib/slabcrack/detect-card-boxes-parse"
import {
  geminiVisionModelCandidates,
  isGeminiModelUnavailable,
} from "@/lib/slabcrack/gemini-models"
import {
  extractGeminiAnswerText,
  thinkingConfigForModel,
  type GeminiGenerateResponse,
} from "@/lib/slabcrack/identify-parse"

export type { DetectedCardBox }
export type DetectCardBoxesResult = {
  ok: true
  boxes: DetectedCardBox[]
  source: "gemini" | "openai"
}

const BOX_PROMPT = [
  "Find every Pokemon TCG card visible in this photo (binder page, hand, table, or sleeve).",
  'Return JSON only: {"cards":[{"x":0,"y":0,"w":0,"h":0,"confidence":0}]}',
  "x,y are the top-left of each card box as fractions of image width/height (0-1).",
  "w,h are width/height as fractions of image width/height (0-1).",
  "Return 1–9 cards, highest confidence first. Tight boxes on the card artwork/border only.",
  "Ignore binder rings, empty pockets, text overlays, and non-card rectangles.",
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
    maxOutputTokens: 2048,
    temperature: 0,
    ...(thinking ? { thinkingConfig: thinking } : {}),
  }
}

async function detectBoxesWithGemini(imageDataUrl: string): Promise<DetectedCardBox[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.")

  const models = geminiVisionModelCandidates()
  const { mimeType, base64 } = splitDataUrl(imageDataUrl)
  let lastError = "Gemini box detection failed."

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
                { text: BOX_PROMPT },
                { inlineData: { mimeType, data: base64 } },
              ],
            },
          ],
          generationConfig: buildGenerationConfig(model),
        }),
      })

      if (response.status === 429 || response.status === 503) {
        lastError = `Gemini box detection overloaded (${response.status}) on ${model}`
        await sleep(500 * (attempt + 1))
        continue
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "")
        lastError = `Gemini box detection failed (${response.status}) on ${model}: ${body.slice(0, 280)}`
        // Retired / unavailable model id → try the next candidate.
        if (isGeminiModelUnavailable(response.status, body)) {
          break
        }
        // Bad thinkingConfig for this model family → skip to next model.
        if (response.status === 400 && /thinking/i.test(body)) {
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
        lastError = `Gemini returned empty box detection from ${model}.`
        break
      }
      return parseCardBoxesJson(raw, "Gemini")
    }
  }

  throw new Error(lastError)
}

async function detectBoxesWithOpenAI(imageDataUrl: string): Promise<DetectedCardBox[]> {
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
          content: "You locate Pokemon TCG cards in photos and return tight bounding boxes as JSON.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: BOX_PROMPT },
            { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`OpenAI box detection failed (${response.status}): ${body.slice(0, 200)}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = json.choices?.[0]?.message?.content?.trim()
  if (!raw) throw new Error("OpenAI returned empty box detection.")
  return parseCardBoxesJson(raw, "OpenAI")
}

export async function detectCardBoxes(imageDataUrl: string): Promise<DetectCardBoxesResult> {
  const prefer = (process.env.SLABCRACK_VISION_PROVIDER?.trim() || "auto").toLowerCase()
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim())
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim())

  if (!hasGemini && !hasOpenAI) {
    throw new Error("No vision API key configured for card box detection.")
  }

  if (prefer === "openai" || (!hasGemini && hasOpenAI)) {
    return { ok: true, boxes: await detectBoxesWithOpenAI(imageDataUrl), source: "openai" }
  }

  try {
    return { ok: true, boxes: await detectBoxesWithGemini(imageDataUrl), source: "gemini" }
  } catch (error) {
    if (hasOpenAI) {
      console.warn(
        "[slabcrack-boxes] Gemini failed — falling back to OpenAI:",
        error instanceof Error ? error.message : error,
      )
      return { ok: true, boxes: await detectBoxesWithOpenAI(imageDataUrl), source: "openai" }
    }
    throw error
  }
}
