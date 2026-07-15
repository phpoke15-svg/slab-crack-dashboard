import { extractJsonObject } from "@/lib/slabcrack/identify-parse"

export type DetectedCardBox = {
  x: number
  y: number
  w: number
  h: number
  confidence: number
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function parseCardBoxesJson(raw: string, provider: string): DetectedCardBox[] {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>
  } catch {
    throw new Error(`${provider} returned invalid JSON for card boxes.`)
  }

  const list = Array.isArray(parsed.cards)
    ? parsed.cards
    : Array.isArray(parsed.boxes)
      ? parsed.boxes
      : null

  if (!list) {
    throw new Error(`${provider} did not return any card boxes.`)
  }

  const boxes: DetectedCardBox[] = []
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const x = clamp01(Number(row.x))
    const y = clamp01(Number(row.y))
    const w = clamp01(Number(row.w ?? row.width))
    const h = clamp01(Number(row.h ?? row.height))
    const confidenceRaw = Number(row.confidence)
    const confidence = Number.isFinite(confidenceRaw) ? clamp01(confidenceRaw) : 0.5
    if (w < 0.04 || h < 0.04) continue
    if (x + w > 1.02 || y + h > 1.02) continue
    boxes.push({
      x,
      y,
      w: Math.min(w, 1 - x),
      h: Math.min(h, 1 - y),
      confidence,
    })
  }

  boxes.sort((a, b) => b.confidence - a.confidence || a.y - b.y || a.x - b.x)
  return boxes.slice(0, 9)
}
