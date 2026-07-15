const configured = (process.env.GEMINI_VISION_MODEL || "").trim()
const isStale25 = /gemini-2\.5-flash/i.test(configured)
const primary = !isStale25 && configured ? configured : "gemini-3.5-flash"
const fallback = "gemini-flash-latest"
const MODEL_CANDIDATES = primary === fallback ? [primary] : [primary, fallback]

const GEMINI_DETECT_TIMEOUT_MS = 22_000

const OBJECT_SCHEMA = {
  type: "OBJECT",
  properties: {
    cards: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          box_2d: {
            type: "ARRAY",
            description: "Bounding box [ymin, xmin, ymax, xmax] normalized 0-1000",
            items: { type: "INTEGER", format: "int32" },
            minItems: 4,
            maxItems: 4,
          },
          name: { type: "STRING" },
          set: { type: "STRING" },
          number: { type: "STRING" },
        },
        required: ["box_2d", "name", "set", "number"],
      },
    },
  },
  required: ["cards"],
}

const SCAN_PROMPT = [
  "Detect every Pokemon trading card visible in this image.",
  "Cards may be alone, in a hand, on a table, or in a binder page — any count.",
  "Return bounding boxes for each card.",
  "box_2d MUST be [ymin, xmin, ymax, xmax] with integer coordinates normalized from 0 to 1000.",
  "Also return name, set, and number for each card (use empty string if unknown).",
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

function toNum(v) {
  if (typeof v === "number") return v
  if (typeof v === "string") return Number(v.trim())
  return NaN
}

export function normalizeBox(raw) {
  let ymin, xmin, ymax, xmax
  if (Array.isArray(raw) && raw.length >= 4) {
    ;[ymin, xmin, ymax, xmax] = raw.map(toNum)
  } else if (raw && typeof raw === "object") {
    if (raw.ymin != null) {
      ymin = toNum(raw.ymin)
      xmin = toNum(raw.xmin)
      ymax = toNum(raw.ymax)
      xmax = toNum(raw.xmax)
    } else if (raw.x != null && raw.y != null) {
      const x = toNum(raw.x)
      const y = toNum(raw.y)
      const w = toNum(raw.w ?? raw.width)
      const h = toNum(raw.h ?? raw.height)
      ymin = y
      xmin = x
      ymax = y + h
      xmax = x + w
    } else return null
  } else return null

  if (![ymin, xmin, ymax, xmax].every((n) => Number.isFinite(n))) return null
  const maxAbs = Math.max(Math.abs(ymin), Math.abs(xmin), Math.abs(ymax), Math.abs(xmax))
  if (maxAbs <= 1.5) {
    ymin *= 1000
    xmin *= 1000
    ymax *= 1000
    xmax *= 1000
  }
  ymin = Math.max(0, Math.min(1000, Math.round(ymin)))
  xmin = Math.max(0, Math.min(1000, Math.round(xmin)))
  ymax = Math.max(0, Math.min(1000, Math.round(ymax)))
  xmax = Math.max(0, Math.min(1000, Math.round(xmax)))
  if (ymax <= ymin || xmax <= xmin) return null
  if (ymax - ymin < 20 || xmax - xmin < 20) return null
  return [ymin, xmin, ymax, xmax]
}

export function parseDetectJson(text) {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  let payload
  if (cleaned.startsWith("[")) payload = JSON.parse(cleaned)
  else {
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start < 0 || end <= start) throw new Error("Gemini did not return JSON.")
    payload = JSON.parse(cleaned.slice(start, end + 1))
  }
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.cards)
      ? payload.cards
      : Array.isArray(payload?.boxes)
        ? payload.boxes
        : []
  const out = []
  for (const c of list) {
    if (!c || typeof c !== "object") continue
    const box = normalizeBox(c.box_2d) || normalizeBox(c.box2d) || normalizeBox(c.bbox) || normalizeBox(c)
    const name = String(c.name || c.cardName || c.label || "").trim()
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

async function callGemini({ apiKey, model, mimeType, base64, useSchema, timeoutMs }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const thinking = thinkingConfigForModel(model)
  const generationConfig = {
    responseMimeType: "application/json",
    maxOutputTokens: 2048,
    temperature: 0.2,
    ...(thinking ? { thinkingConfig: thinking } : {}),
  }
  if (useSchema) generationConfig.responseSchema = OBJECT_SCHEMA

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
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
      const err = new Error(`Gemini ${model} HTTP ${response.status}: ${bodyText.slice(0, 280)}`)
      err.status = response.status
      err.body = bodyText
      throw err
    }
    return JSON.parse(bodyText)
  } catch (err) {
    if (err?.name === "AbortError") throw new Error(`Gemini ${model} timed out after ${timeoutMs}ms`)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function detectCardsInFrame(input) {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.")

  const { mimeType, base64 } = resolveInlineImage(input)
  if (!base64 || base64.length < 32) throw new Error("Image data missing.")
  if (base64.length > 5_500_000) throw new Error("Image too large.")

  let lastError = "Gemini detection failed."
  let lastRaw = ""

  for (const model of MODEL_CANDIDATES) {
    for (const useSchema of [true, false]) {
      try {
        const data = await callGemini({
          apiKey,
          model,
          mimeType,
          base64,
          useSchema,
          timeoutMs: GEMINI_DETECT_TIMEOUT_MS,
        })
        const text = extractText(data)
        lastRaw = text || ""
        console.log("[live-binder-hud] Gemini raw JSON string:", text)
        const cards = parseDetectJson(text || '{"cards":[]}')
        if (cards.length) return { cards, model, rawJson: text }
        lastError = "Gemini returned JSON but no usable card boxes."
      } catch (err) {
        const status = err?.status
        const body = String(err?.body || "")
        const message = err instanceof Error ? err.message : "Gemini call failed"
        lastError = message
        console.warn("[live-binder-hud] attempt failed", { model, useSchema, status, message: message.slice(0, 240) })
        if (status && isModelUnavailable(status, body)) break
        if (useSchema && (status === 400 || /schema|response_schema|invalid/i.test(message))) continue
        if (/timed out/i.test(message) || status === 429 || (status != null && status >= 500)) break
        if (!useSchema) break
      }
    }
  }

  if (lastRaw) throw new Error(`${lastError} raw=${lastRaw.slice(0, 200)}`)
  throw new Error(lastError)
}
