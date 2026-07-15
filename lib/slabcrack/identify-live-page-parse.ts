import { cleanNumber, extractJsonObject } from "@/lib/slabcrack/identify-parse"

export type LivePageDetectedCard = {
  x: number
  y: number
  w: number
  h: number
  confidence: number
  cardName: string
  setName: string
  cardNumber: string
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

/** Parse Gemini/OpenAI JSON that includes both boxes and card identity. */
export function parseLivePageCardsJson(raw: string, provider: string): LivePageDetectedCard[] {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>
  } catch {
    throw new Error(`${provider} returned invalid JSON for live page cards.`)
  }

  const list = Array.isArray(parsed.cards)
    ? parsed.cards
    : Array.isArray(parsed.boxes)
      ? parsed.boxes
      : null

  if (!list) {
    throw new Error(`${provider} did not return any cards.`)
  }

  const cards: LivePageDetectedCard[] = []
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const x = clamp01(Number(row.x))
    const y = clamp01(Number(row.y))
    const w = clamp01(Number(row.w ?? row.width))
    const h = clamp01(Number(row.h ?? row.height))
    const confidenceRaw = Number(row.confidence)
    const confidence = Number.isFinite(confidenceRaw) ? clamp01(confidenceRaw) : 0.5
    const cardName = String(row.cardName ?? row.name ?? "").trim()
    const setName = String(row.setName ?? row.set ?? "").trim()
    const cardNumber = cleanNumber(String(row.cardNumber ?? row.number ?? ""))

    if (w < 0.04 || h < 0.04) continue
    if (!cardName && !cardNumber) continue

    cards.push({
      x,
      y,
      w: Math.min(w, 1 - x),
      h: Math.min(h, 1 - y),
      confidence,
      cardName,
      setName,
      cardNumber,
    })
  }

  cards.sort((a, b) => b.confidence - a.confidence || a.y - b.y || a.x - b.x)
  return cards.slice(0, 9)
}
