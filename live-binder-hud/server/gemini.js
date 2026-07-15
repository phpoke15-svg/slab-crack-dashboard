const MODEL_CANDIDATES = [
  process.env.GEMINI_VISION_MODEL,
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i)

const SCAN_PROMPT = [
  "You are identifying Pokemon TCG cards.",
  "You will receive 1–9 cropped card images, each labeled Slot N.",
  "Slots are ordered left-to-right, top-to-bottom for whatever cards were detected in frame.",
  "Identify each provided slot image.",
  "Return ONLY JSON in this exact shape:",
  '{"cards":[{"slot":1,"name":"Charizard","set":"Base Set","number":"4/102"}]}',
  "Rules:",
  "- Include every slot image you can read (match the Slot numbers given).",
  "- Omit unreadable slots.",
  "- Prefer English card names.",
  "- set should be the English expansion name when known, else \"\".",
  "- number like \"4/102\" or \"025\" or \"\".",
  "- Do not invent prices. Identity only.",
].join(" ")

function splitDataUrl(imageDataUrl) {
  const match = String(imageDataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) throw new Error("Each pocket image must be a data:image/*;base64 URL.")
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
  if (id.includes("3.") || id.includes("3-") || id.includes("flash-latest")) {
    return { thinkingLevel: "minimal" }
  }
  return null
}

function parseCardsJson(text) {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("Gemini did not return JSON.")
  const parsed = JSON.parse(cleaned.slice(start, end + 1))
  const cards = Array.isArray(parsed?.cards) ? parsed.cards : []
  return cards
    .map((c) => ({
      slot: Number(c.slot),
      name: String(c.name || c.cardName || "").trim(),
      set: String(c.set || c.setName || "").trim(),
      number: String(c.number || c.cardNumber || "").trim(),
    }))
    .filter((c) => Number.isFinite(c.slot) && c.slot >= 1 && c.slot <= 9 && c.name)
    .sort((a, b) => a.slot - b.slot)
}

/**
 * @param {{ slot: number, image: string }[]} pockets
 */
export async function identifyBinderPage(pockets) {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.")

  if (!Array.isArray(pockets) || pockets.length === 0) {
    throw new Error("Provide 1–9 pocket images.")
  }
  if (pockets.length > 9) throw new Error("Maximum 9 pocket images.")

  const parts = [{ text: SCAN_PROMPT }]
  for (const pocket of pockets) {
    const slot = Number(pocket.slot)
    if (!Number.isFinite(slot) || slot < 1 || slot > 9) {
      throw new Error(`Invalid slot: ${pocket.slot}`)
    }
    const { mimeType, base64 } = splitDataUrl(pocket.image)
    parts.push({ text: `Slot ${slot}:` })
    parts.push({ inlineData: { mimeType, data: base64 } })
  }

  let lastError = "Gemini scan failed."

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
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 4096,
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

      const text = extractText(data)
      try {
        const cards = parseCardsJson(text)
        return { cards, model, raw: text }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Failed to parse Gemini JSON."
      }
    }
  }

  throw new Error(lastError)
}
