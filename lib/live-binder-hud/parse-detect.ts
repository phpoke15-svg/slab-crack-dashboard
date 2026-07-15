/** Gemini native object-detection box: [ymin, xmin, ymax, xmax] on a 0–1000 scale. */
export type Box2d = [number, number, number, number]

export type BinderHudDetectedCard = {
  box_2d: Box2d
  name: string
  set: string
  number: string
}

function clamp1000(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1000, Math.round(n)))
}

function normalizeBox(raw: unknown): Box2d | null {
  if (!Array.isArray(raw) || raw.length < 4) return null
  const ymin = clamp1000(Number(raw[0]))
  const xmin = clamp1000(Number(raw[1]))
  const ymax = clamp1000(Number(raw[2]))
  const xmax = clamp1000(Number(raw[3]))
  if (ymax <= ymin || xmax <= xmin) return null
  return [ymin, xmin, ymax, xmax]
}

export function parseBinderHudDetectJson(text: string): BinderHudDetectedCard[] {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("Gemini did not return JSON.")
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
    cards?: Array<Record<string, unknown>>
  }
  const cards = Array.isArray(parsed?.cards) ? parsed.cards : []
  const out: BinderHudDetectedCard[] = []
  for (const c of cards) {
    const box =
      normalizeBox(c.box_2d) ||
      normalizeBox(c.box2d) ||
      normalizeBox(c.bbox) ||
      null
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
