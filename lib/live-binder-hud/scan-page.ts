import "server-only"
import {
  geminiVisionModelCandidates,
  isGeminiModelUnavailable,
} from "@/lib/slabcrack/gemini-models"
import {
  extractGeminiAnswerText,
  thinkingConfigForModel,
  type GeminiGenerateResponse,
} from "@/lib/slabcrack/identify-parse"
import {
  parseBinderHudDetectJson,
  type BinderHudDetectedCard,
} from "@/lib/live-binder-hud/parse-detect"

export type { BinderHudDetectedCard, Box2d } from "@/lib/live-binder-hud/parse-detect"
export { parseBinderHudDetectJson } from "@/lib/live-binder-hud/parse-detect"

const SCAN_PROMPT = [
  "Detect every Pokemon / trading card visible in this photo.",
  "Cards may appear alone, in a hand, on a table, or in a binder page (any count).",
  "Return ONLY JSON in this exact shape:",
  '{"cards":[{"box_2d":[ymin,xmin,ymax,xmax],"name":"Card Name","set":"Set Reference","number":"Card Number"}]}',
  "box_2d must be normalized integers from 0 to 1000: [ymin, xmin, ymax, xmax].",
  "Include every clearly visible trading card (typically 1–9; more is ok if present).",
  "Prefer English names. set can be \"\" if unknown. number like \"4/102\" or \"025\" or \"\".",
  "Tight boxes around each card only. Do not invent prices.",
].join(" ")

/** Prefer models the HUD was designed against; still cascade through current Flash IDs. */
export function binderHudGeminiModels(): string[] {
  const preferred = (process.env.GEMINI_VISION_MODEL || "").trim()
  const hudDefaults = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
  ]
  return [preferred, ...hudDefaults, ...geminiVisionModelCandidates()].filter(
    (m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i,
  )
}

function splitDataUrl(imageDataUrl: string): { mimeType: string; base64: string } {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) throw new Error("Expected a data:image base64 URL from the camera capture.")
  return { mimeType: match[1]!, base64: match[2]! }
}

/**
 * Zero-shot multi-card detect + identify on a single still frame.
 */
export async function detectCardsInFrame(imageDataUrl: string): Promise<{
  cards: BinderHudDetectedCard[]
  model: string
}> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.")
  if (!imageDataUrl || imageDataUrl.length > 6_000_000) {
    throw new Error("Image missing or too large.")
  }

  const { mimeType, base64 } = splitDataUrl(imageDataUrl)
  let lastError = "Gemini detection failed."

  for (const model of binderHudGeminiModels()) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
      const thinking = thinkingConfigForModel(model)
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
                { text: SCAN_PROMPT },
                { inlineData: { mimeType, data: base64 } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
            temperature: 0,
            ...(thinking ? { thinkingConfig: thinking } : {}),
          },
        }),
      })

      const bodyText = await response.text()
      if (!response.ok) {
        lastError = `Gemini ${model} HTTP ${response.status}: ${bodyText.slice(0, 240)}`
        if (isGeminiModelUnavailable(response.status, bodyText)) break
        if (response.status === 429 || response.status >= 500) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
          continue
        }
        throw new Error(lastError)
      }

      let data: GeminiGenerateResponse
      try {
        data = JSON.parse(bodyText) as GeminiGenerateResponse
      } catch {
        lastError = `Gemini ${model} returned non-JSON.`
        continue
      }

      const { text } = extractGeminiAnswerText(data)
      try {
        const cards = parseBinderHudDetectJson(text)
        return { cards, model }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Failed to parse Gemini JSON."
      }
    }
  }

  throw new Error(lastError)
}
