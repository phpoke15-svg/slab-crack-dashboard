import "server-only"
import {
  lookupCardById,
  lookupCardByPokemonId,
  searchCatalogCards,
  searchHitToPlaceholder,
  type CardSearchHit,
} from "@/lib/card-lookup"
import { normalizeCardEntry, type MockCardEntry } from "@/lib/slab-data"

export type DetectedCard = {
  cardName: string
  setName: string
  cardNumber: string
  confidence: number
  notes?: string
}

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
  "Identify the Pokémon trading card in this photo.",
  "Return JSON with keys:",
  'cardName (string, pokemon name + stage like "Umbreon ex"),',
  "setName (string, English set name if visible, else empty string),",
  'cardNumber (string, collector number like "161" or "161/131", else empty),',
  "confidence (number 0-1),",
  "notes (short string).",
  "Prefer the English name when bilingual. Ignore PSA slabs labels for the card identity.",
  "If unsure, still guess the most likely cardName + cardNumber and lower confidence.",
].join(" ")

function cleanNumber(raw: string): string {
  const trimmed = raw.trim()
  const slash = trimmed.match(/^#?(\d{1,4})\s*\/\s*\d{1,4}$/)
  if (slash) return slash[1]
  const bare = trimmed.match(/^#?(\d{1,4}[a-z]?)$/i)
  if (bare) return bare[1]
  return trimmed.replace(/^#/, "").trim()
}

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

function parseDetectedJson(raw: string, provider: string): DetectedCard {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    throw new Error(`${provider} returned invalid JSON for card identity.`)
  }

  const cardName = String(parsed.cardName ?? "").trim()
  const setName = String(parsed.setName ?? "").trim()
  const cardNumber = cleanNumber(String(parsed.cardNumber ?? ""))
  const confidenceRaw = Number(parsed.confidence)
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : 0.5
  const notes = String(parsed.notes ?? "").trim() || undefined

  if (!cardName && !cardNumber) {
    throw new Error("Could not read a card name or number from the photo.")
  }

  return { cardName, setName, cardNumber, confidence, notes }
}

function splitDataUrl(imageDataUrl: string): { mimeType: string; base64: string } {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) {
    throw new Error("Expected a data:image base64 URL from the camera capture.")
  }
  return { mimeType: match[1], base64: match[2] }
}

async function detectWithGemini(imageDataUrl: string): Promise<DetectedCard> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.")
  }

  const model = process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.5-flash"
  const { mimeType, base64 } = splitDataUrl(imageDataUrl)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: IDENTIFY_PROMPT },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Gemini vision failed (${response.status}): ${body.slice(0, 240)}`)
  }

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const raw = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim()
  if (!raw) throw new Error("Gemini returned an empty identification.")
  return parseDetectedJson(raw, "Gemini")
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
          content:
            "You identify Pokémon TCG trading cards from photos. Return strict JSON only.",
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
    return { detected: await detectWithGemini(imageDataUrl), source: "gemini" }
  }

  // auto: Gemini first (usable free tier), then OpenAI paid
  if (hasGemini) {
    return { detected: await detectWithGemini(imageDataUrl), source: "gemini" }
  }
  if (hasOpenAI) {
    return { detected: await detectWithOpenAI(imageDataUrl), source: "openai" }
  }

  throw new Error(
    "No vision API key configured. Add GEMINI_API_KEY (free at Google AI Studio) or a paid OPENAI_API_KEY in Vercel env.",
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
 * Vision-identify a card photo, then resolve live SlabCrack pricing for the best match.
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
