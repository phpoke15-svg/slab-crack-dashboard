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
  BINDER_HUD_RESPONSE_SCHEMA,
  BINDER_HUD_SCAN_PROMPT,
} from "@/lib/live-binder-hud/gemini-schema"
import {
  parseBinderHudDetectJson,
  type BinderHudDetectedCard,
} from "@/lib/live-binder-hud/parse-detect"

export type { BinderHudDetectedCard, Box2d } from "@/lib/live-binder-hud/parse-detect"
export { parseBinderHudDetectJson } from "@/lib/live-binder-hud/parse-detect"

export type BinderHudImageInput = {
  /** Raw base64 without data-URL prefix (preferred). */
  data?: string
  mimeType?: string
  /** Full data URL fallback: data:image/jpeg;base64,... */
  image?: string
}

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

function resolveInlineImage(input: BinderHudImageInput | string): {
  mimeType: string
  base64: string
} {
  if (typeof input === "string") {
    const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
    if (match) return { mimeType: match[1]!, base64: match[2]! }
    // Already-stripped base64
    if (/^[A-Za-z0-9+/=\s]+$/.test(input) && input.length > 100) {
      return { mimeType: "image/jpeg", base64: input.replace(/\s+/g, "") }
    }
    throw new Error("Expected raw base64 or a data:image/*;base64 URL.")
  }

  if (input.data && input.data.length > 100) {
    const mimeType = (input.mimeType || "image/jpeg").trim() || "image/jpeg"
    const base64 = String(input.data)
      .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "")
      .replace(/\s+/g, "")
    return { mimeType, base64 }
  }

  if (input.image) return resolveInlineImage(input.image)
  throw new Error("Missing image data (send mimeType + data base64 without prefix).")
}

async function callGeminiDetect(opts: {
  apiKey: string
  model: string
  mimeType: string
  base64: string
  useSchema: boolean
}): Promise<{ text: string; finishReason?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`
  const thinking = thinkingConfigForModel(opts.model)
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    maxOutputTokens: 8192,
    temperature: 0,
    ...(thinking ? { thinkingConfig: thinking } : {}),
  }
  if (opts.useSchema) {
    generationConfig.responseSchema = BINDER_HUD_RESPONSE_SCHEMA
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": opts.apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: BINDER_HUD_SCAN_PROMPT },
            { inlineData: { mimeType: opts.mimeType, data: opts.base64 } },
          ],
        },
      ],
      generationConfig,
    }),
  })

  const bodyText = await response.text()
  if (!response.ok) {
    const err = new Error(
      `Gemini ${opts.model} HTTP ${response.status}: ${bodyText.slice(0, 320)}`,
    ) as Error & { status?: number; body?: string }
    err.status = response.status
    err.body = bodyText
    throw err
  }

  const data = JSON.parse(bodyText) as GeminiGenerateResponse
  const extracted = extractGeminiAnswerText(data)
  return { text: extracted.text, finishReason: extracted.finishReason }
}

/**
 * Zero-shot multi-card detect + identify on a single still frame.
 * Accepts stripped base64 (+ mimeType) or a full data URL.
 */
export async function detectCardsInFrame(input: BinderHudImageInput | string): Promise<{
  cards: BinderHudDetectedCard[]
  model: string
  rawJson: string
}> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.")

  const { mimeType, base64 } = resolveInlineImage(input)
  if (!base64 || base64.length < 32) throw new Error("Image data missing.")
  if (base64.length > 5_500_000) throw new Error("Image too large.")

  console.log("[live-binder-hud] Gemini request", {
    mimeType,
    base64Chars: base64.length,
    base64Head: base64.slice(0, 32),
  })

  let lastError = "Gemini detection failed."

  for (const model of binderHudGeminiModels()) {
    for (const useSchema of [true, false]) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const { text, finishReason } = await callGeminiDetect({
            apiKey,
            model,
            mimeType,
            base64,
            useSchema,
          })

          console.log("[live-binder-hud] Gemini raw JSON string:", text)
          console.log("[live-binder-hud] Gemini finishReason:", finishReason, "model:", model, "schema:", useSchema)

          const cards = parseBinderHudDetectJson(text || '{"cards":[]}')
          console.log(
            "[live-binder-hud] Parsed cards:",
            cards.map((c) => ({ name: c.name, box_2d: c.box_2d })),
          )
          return { cards, model, rawJson: text }
        } catch (err) {
          const status = (err as { status?: number }).status
          const body = String((err as { body?: string }).body || "")
          const message = err instanceof Error ? err.message : "Gemini call failed"
          lastError = message
          console.warn("[live-binder-hud] Gemini attempt failed", {
            model,
            useSchema,
            attempt,
            status,
            message: message.slice(0, 280),
          })

          if (status && isGeminiModelUnavailable(status, body)) break
          // Schema unsupported → retry same model without schema
          if (useSchema && (status === 400 || /schema|response_schema|invalid/i.test(message))) {
            break
          }
          if (status === 429 || (status != null && status >= 500)) {
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
            continue
          }
          if (!useSchema && status && status < 500 && status !== 429) {
            // Hard failure for this model
            break
          }
        }
      }
    }
  }

  throw new Error(lastError)
}
