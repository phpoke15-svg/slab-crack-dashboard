import "server-only"
import { isGeminiModelUnavailable } from "@/lib/slabcrack/gemini-models"
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
  data?: string
  mimeType?: string
  image?: string
}

/** Keep the cascade tiny — Vercel will 504 if we fan out across many models/schemas. */
export function binderHudGeminiModels(): string[] {
  const preferred = (process.env.GEMINI_VISION_MODEL || "").trim()
  const defaults = ["gemini-2.5-flash", "gemini-3.5-flash"]
  return [preferred, ...defaults].filter(
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
  timeoutMs: number
}): Promise<{ text: string; finishReason?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`
  const thinking = thinkingConfigForModel(opts.model)
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    maxOutputTokens: 4096,
    temperature: 0.2,
    ...(thinking ? { thinkingConfig: thinking } : {}),
  }
  if (opts.useSchema) {
    generationConfig.responseSchema = BINDER_HUD_RESPONSE_SCHEMA
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs)
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": opts.apiKey,
      },
      signal: controller.signal,
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
        `Gemini ${opts.model} HTTP ${response.status}: ${bodyText.slice(0, 280)}`,
      ) as Error & { status?: number; body?: string }
      err.status = response.status
      err.body = bodyText
      throw err
    }

    const data = JSON.parse(bodyText) as GeminiGenerateResponse
    const extracted = extractGeminiAnswerText(data)
    return { text: extracted.text, finishReason: extracted.finishReason }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Gemini ${opts.model} timed out after ${opts.timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fast zero-shot multi-card detect — 1–2 Gemini calls max.
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
    models: binderHudGeminiModels(),
  })

  let lastError = "Gemini detection failed."
  let lastRaw = ""

  for (const model of binderHudGeminiModels()) {
    // Prefer structured schema; one free-JSON fallback if schema fails / empty.
    for (const useSchema of [true, false]) {
      try {
        const { text, finishReason } = await callGeminiDetect({
          apiKey,
          model,
          mimeType,
          base64,
          useSchema,
          timeoutMs: 28_000,
        })

        lastRaw = text || ""
        console.log("[live-binder-hud] Gemini raw JSON string:", text)
        console.log("[live-binder-hud] meta", { model, useSchema, finishReason })

        const cards = parseBinderHudDetectJson(text || '{"cards":[]}')
        console.log(
          "[live-binder-hud] Parsed cards:",
          cards.map((c) => ({ name: c.name, box_2d: c.box_2d })),
        )

        if (cards.length) {
          return { cards, model, rawJson: text }
        }
        lastError = "Gemini returned JSON but no usable card boxes."
      } catch (err) {
        const status = (err as { status?: number }).status
        const body = String((err as { body?: string }).body || "")
        const message = err instanceof Error ? err.message : "Gemini call failed"
        lastError = message
        console.warn("[live-binder-hud] attempt failed", { model, useSchema, status, message: message.slice(0, 240) })

        if (status && isGeminiModelUnavailable(status, body)) break
        if (useSchema && (status === 400 || /schema|response_schema|invalid/i.test(message))) {
          continue // try without schema
        }
        // On timeout / 5xx, try next model
        if (/timed out/i.test(message) || status === 429 || (status != null && status >= 500)) {
          break
        }
        if (!useSchema) break
      }
    }
  }

  if (lastRaw) throw new Error(`${lastError} raw=${lastRaw.slice(0, 200)}`)
  throw new Error(lastError)
}
