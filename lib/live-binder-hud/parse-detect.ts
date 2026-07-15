/** Gemini native object-detection box: [ymin, xmin, ymax, xmax] on a 0–1000 scale. */
export type Box2d = [number, number, number, number]

export type BinderHudDetectedCard = {
  box_2d: Box2d
  name: string
  set: string
  number: string
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v
  if (typeof v === "string") return Number(v.trim())
  return NaN
}

/**
 * Normalize a box to [ymin, xmin, ymax, xmax] on 0–1000.
 * Accepts:
 *  - 0–1000 integers/floats
 *  - 0–1 floats
 *  - [xmin, ymin, xmax, ymax] if values clearly look swapped (rare)
 *  - {ymin,xmin,ymax,xmax} / {x,y,w,h} / {x_min,...} objects
 */
export function normalizeBox(raw: unknown): Box2d | null {
  let ymin: number
  let xmin: number
  let ymax: number
  let xmax: number

  if (Array.isArray(raw) && raw.length >= 4) {
    ymin = toNum(raw[0])
    xmin = toNum(raw[1])
    ymax = toNum(raw[2])
    xmax = toNum(raw[3])
  } else if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>
    if (o.ymin != null && o.xmin != null && o.ymax != null && o.xmax != null) {
      ymin = toNum(o.ymin)
      xmin = toNum(o.xmin)
      ymax = toNum(o.ymax)
      xmax = toNum(o.xmax)
    } else if (o.y_min != null && o.x_min != null) {
      ymin = toNum(o.y_min)
      xmin = toNum(o.x_min)
      ymax = toNum(o.y_max)
      xmax = toNum(o.x_max)
    } else if (o.x != null && o.y != null && (o.w != null || o.width != null)) {
      // 0–1 (or 0–1000) xywh → ymin,xmin,ymax,xmax
      const x = toNum(o.x)
      const y = toNum(o.y)
      const w = toNum(o.w ?? o.width)
      const h = toNum(o.h ?? o.height)
      ymin = y
      xmin = x
      ymax = y + h
      xmax = x + w
    } else {
      return null
    }
  } else {
    return null
  }

  if (![ymin, xmin, ymax, xmax].every((n) => Number.isFinite(n))) return null

  // Detect 0–1 normalized coords (common when models ignore the 0–1000 instruction)
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
  // Reject tiny / degenerate boxes (< ~2% of frame)
  if (ymax - ymin < 20 || xmax - xmin < 20) return null

  return [ymin, xmin, ymax, xmax]
}

function cardFromRow(row: Record<string, unknown>): BinderHudDetectedCard | null {
  const box =
    normalizeBox(row.box_2d) ||
    normalizeBox(row.box2d) ||
    normalizeBox(row.bbox) ||
    normalizeBox(row.bounding_box) ||
    normalizeBox(row) // xywh on the row itself

  const name = String(row.name || row.cardName || row.label || "").trim()
  if (!box || !name) return null

  return {
    box_2d: box,
    name,
    set: String(row.set || row.setName || "").trim(),
    number: String(row.number || row.cardNumber || "").trim(),
  }
}

export function parseBinderHudDetectJson(text: string): BinderHudDetectedCard[] {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  // Prefer object slice; also allow a top-level JSON array
  let payload: unknown
  try {
    if (cleaned.startsWith("[")) {
      payload = JSON.parse(cleaned)
    } else {
      const start = cleaned.indexOf("{")
      const end = cleaned.lastIndexOf("}")
      if (start < 0 || end <= start) throw new Error("no json")
      payload = JSON.parse(cleaned.slice(start, end + 1))
    }
  } catch {
    throw new Error("Gemini did not return JSON.")
  }

  let list: unknown[] = []
  if (Array.isArray(payload)) {
    list = payload
  } else if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>
    if (Array.isArray(obj.cards)) list = obj.cards
    else if (Array.isArray(obj.boxes)) list = obj.boxes
    else if (Array.isArray(obj.items)) list = obj.items
  }

  const out: BinderHudDetectedCard[] = []
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const card = cardFromRow(item as Record<string, unknown>)
    if (card) out.push(card)
  }

  out.sort((a, b) => a.box_2d[0] - b.box_2d[0] || a.box_2d[1] - b.box_2d[1])
  return out
}
