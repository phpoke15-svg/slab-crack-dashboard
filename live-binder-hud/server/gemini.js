const MODEL_CANDIDATES = [
  process.env.GEMINI_VISION_MODEL,
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i)

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

function splitDataUrl(imageDataUrl) {
  const match = String(imageDataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) throw new Error("Expected a data:image base64 URL from the camera capture.")
  return { mimeType: match[1], base64: match[2] }
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

/**
 * Full-frame zero-shot detect + identify.
 * @param {string} imageDataUrl
 */
export async function detectCardsInFrame(imageDataUrl) {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.")
  if (!imageDataUrl || imageDataUrl.length > 6_000_000) {
    throw new Error("Image missing or too large.")
  }

  const { mimeType, base64 } = splitDataUrl(imageDataUrl)
  let lastError = "Gemini detection failed."

  for (const model of MODEL_CANDIDATES) {
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
        if (isModelUnavailable(response.status, bodyText)) break
        if (response.status === 429 || response.status >= 500) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
          continue
        }
        throw new Error(lastError)
      }

      let data
      try {
        data = JSON.parse(bodyText)
      } catch {
        lastError = `Gemini ${model} returned non-JSON.`
        continue
      }

      try {
        const cards = parseDetectJson(extractText(data))
        return { cards, model }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Failed to parse Gemini JSON."
      }
    }
  }

  throw new Error(lastError)
}
