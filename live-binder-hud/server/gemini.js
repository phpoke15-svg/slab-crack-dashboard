const MODEL_CANDIDATES = [
  process.env.GEMINI_VISION_MODEL,
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i)

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          box_2d: {
            type: "array",
            items: { type: "integer" },
            description:
              "Bounding box coordinates normalized to 0-1000 in ymin, xmin, ymax, xmax format.",
          },
          name: { type: "string" },
          set: { type: "string" },
          number: { type: "string" },
        },
        required: ["box_2d", "name", "set", "number"],
      },
    },
  },
  required: ["cards"],
}

const SCAN_PROMPT = [
  "Detect every Pokemon / trading card visible in this photo.",
  "Cards may appear alone, in a hand, on a table, or in a binder page (any count).",
  "Use Gemini 2D bounding boxes normalized from 0 to 1000.",
  "box_2d MUST be [ymin, xmin, ymax, xmax] integers on that 0–1000 scale.",
  "Return JSON matching the response schema exactly.",
  "Include every clearly visible trading card.",
  "Prefer English names. If set or number is unknown use an empty string.",
  "Tight boxes around each card only. Do not invent prices.",
].join(" ")

function resolveInlineImage(input) {
  if (typeof input === "string") {
    const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
    if (match) return { mimeType: match[1], base64: match[2] }
    if (input.length > 100) return { mimeType: "image/jpeg", base64: input.replace(/\s+/g, "") }
    throw new Error("Expected raw base64 or a data:image/*;base64 URL.")
  }
  if (input?.data && String(input.data).length > 100) {
    return {
      mimeType: (input.mimeType || "image/jpeg").trim() || "image/jpeg",
      base64: String(input.data)
        .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "")
        .replace(/\s+/g, ""),
    }
  }
  if (input?.image) return resolveInlineImage(input.image)
  throw new Error("Missing image data (send mimeType + data base64 without prefix).")
}

function isModelUnavailable(status, body) {
  if (status === 404) return true
  return /no longer available|not found|not supported|update your code to use a newer model|update to newest/i.test(
    body,
  )
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ""
  return parts.map((p) => p?.text || "").join("").trim()
}

function thinkingConfigForModel(model) {
  const id = String(model || "").toLowerCase()
  if (id.includes("2.5")) return { thinkingBudget: 0 }
  if (id.includes("2.0")) return null
  if (id.includes("3.") || id.includes("3-") || id.includes("flash-latest")) {
    return { thinkingLevel: "minimal" }
  }
  return null
}

function clamp1000(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1000, Math.round(n)))
}

function normalizeBox(raw) {
  if (!Array.isArray(raw) || raw.length < 4) return null
  const ymin = clamp1000(Number(raw[0]))
  const xmin = clamp1000(Number(raw[1]))
  const ymax = clamp1000(Number(raw[2]))
  const xmax = clamp1000(Number(raw[3]))
  if (ymax <= ymin || xmax <= xmin) return null
  return [ymin, xmin, ymax, xmax]
}

export function parseDetectJson(text) {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("Gemini did not return JSON.")
  const parsed = JSON.parse(cleaned.slice(start, end + 1))
  const cards = Array.isArray(parsed?.cards) ? parsed.cards : []
  const out = []
  for (const c of cards) {
    const box = normalizeBox(c.box_2d) || normalizeBox(c.box2d) || normalizeBox(c.bbox)
    const name = String(c.name || c.cardName || "").trim()
    if (!box || !name) continue
    out.push({
      box_2d: box,
      name,
      set: String(c.set || c.setName || "").trim(),
      number: String(c.number || c.cardNumber || "").trim(),
    })
  }
  out.sort((a, b) => a.box_2d[0] - b.box_2d[0] || a.box_2d[1] - b.box_2d[1])
  return out
}

async function callGemini({ apiKey, model, mimeType, base64, useSchema }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const thinking = thinkingConfigForModel(model)
  const generationConfig = {
    responseMimeType: "application/json",
    maxOutputTokens: 8192,
    temperature: 0,
    ...(thinking ? { thinkingConfig: thinking } : {}),
  }
  if (useSchema) generationConfig.responseSchema = RESPONSE_SCHEMA

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
      generationConfig,
    }),
  })

  const bodyText = await response.text()
  if (!response.ok) {
    const err = new Error(`Gemini ${model} HTTP ${response.status}: ${bodyText.slice(0, 320)}`)
    err.status = response.status
    err.body = bodyText
    throw err
  }
  return JSON.parse(bodyText)
}

/**
 * @param {{ data?: string, mimeType?: string, image?: string } | string} input
 */
export async function detectCardsInFrame(input) {
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

  for (const model of MODEL_CANDIDATES) {
    for (const useSchema of [true, false]) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const data = await callGemini({ apiKey, model, mimeType, base64, useSchema })
          const text = extractText(data)
          console.log("[live-binder-hud] Gemini raw JSON string:", text)
          console.log("[live-binder-hud] model:", model, "schema:", useSchema)

          const cards = parseDetectJson(text || '{"cards":[]}')
          console.log(
            "[live-binder-hud] Parsed cards:",
            cards.map((c) => ({ name: c.name, box_2d: c.box_2d })),
          )
          return { cards, model, rawJson: text }
        } catch (err) {
          const status = err?.status
          const body = String(err?.body || "")
          const message = err instanceof Error ? err.message : "Gemini call failed"
          lastError = message
          console.warn("[live-binder-hud] attempt failed", { model, useSchema, attempt, status, message: message.slice(0, 240) })
          if (status && isModelUnavailable(status, body)) break
          if (useSchema && (status === 400 || /schema|response_schema|invalid/i.test(message))) break
          if (status === 429 || (status != null && status >= 500)) {
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
            continue
          }
          if (!useSchema && status && status < 500 && status !== 429) break
        }
      }
    }
  }

  throw new Error(lastError)
}
