import type { DetectedCard } from "./types"

const COLLECTOR_NUMBER_RE = /\b([a-z]{0,3}\d{1,4}[a-z]?)\s*\/\s*([a-z]{0,3}\d{1,4})\b/i
const NOISE_LINE_RE =
  /^(hp\b|weakness|resistance|retreat|pok[eé]mon|trainer|energy|illus|©|basic|stage|ability|attack|rarity|confetti)/i
const ATTACK_LINE_RE =
  /\b(damage|during your turn|your opponent|coin|tails|heads|bench|switch|attach|discard|draw|knock out)\b/i

export function cleanNumber(raw: string): string {
  const trimmed = raw.trim().replace(/^#/, "")
  if (!trimmed) return ""

  const slash = trimmed.match(/^([a-z]{0,3}\d{1,4}[a-z]?)\s*\/\s*\d{1,4}$/i)
  if (slash) return slash[1]!.replace(/^0+(?=\d)/, "")

  const prefixed = trimmed.match(/^([a-z]{1,3})0*(\d{1,4}[a-z]?)$/i)
  if (prefixed) return `${prefixed[1]!.toUpperCase()}${prefixed[2]!.replace(/^0+(?=\d)/, "")}`

  const bare = trimmed.match(/^(\d{1,4}[a-z]?)$/i)
  if (bare) return bare[1]!.replace(/^0+(?=\d)/, "")

  return trimmed
}

export function simplifyCardName(name: string): string {
  return name
    .replace(
      /\b(special illustration rare|illustration rare|hyper rare|secret rare|ultra rare|amazing rare|radiant|full art|alt art|sir|ir)\b/gi,
      "",
    )
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function extractCollectorNumberFromText(text: string): string {
  const normalized = text.replace(/\s+/g, " ")
  const match = normalized.match(COLLECTOR_NUMBER_RE)
  if (!match) return ""

  const left = match[1]!.replace(/\s+/g, "")
  const right = match[2]!.replace(/\s+/g, "")
  if (/[a-z]/i.test(left)) return cleanNumber(left) || left
  return cleanNumber(`${left}/${right}`)
}

function isLikelyCardNameLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 3 || trimmed.length > 48) return false
  if (COLLECTOR_NUMBER_RE.test(trimmed)) return false
  if (NOISE_LINE_RE.test(trimmed)) return false
  if (ATTACK_LINE_RE.test(trimmed)) return false
  if (/^\d+$/.test(trimmed)) return false

  const letters = trimmed.replace(/[^a-z]/gi, "").length
  const digits = trimmed.replace(/[^0-9]/g, "").length
  if (letters < 3) return false
  if (digits > letters) return false

  return true
}

function pickCardName(lines: string[], numberLineIndex: number): string {
  const candidates: string[] = []

  for (let i = 0; i < Math.min(3, lines.length); i += 1) {
    const line = lines[i]?.trim()
    if (line && isLikelyCardNameLine(line)) candidates.push(line)
  }

  if (numberLineIndex >= 0) {
    for (let i = Math.max(0, numberLineIndex - 3); i < numberLineIndex; i += 1) {
      const line = lines[i]?.trim()
      if (line && isLikelyCardNameLine(line)) candidates.push(line)
    }
  }

  for (const line of lines) {
    if (isLikelyCardNameLine(line)) candidates.push(line)
  }

  const ranked = [...new Set(candidates)].sort((a, b) => {
    const aSimple = simplifyCardName(a)
    const bSimple = simplifyCardName(b)
    const lenDiff = aSimple.length - bSimple.length
    if (lenDiff !== 0) return lenDiff
    return aSimple.localeCompare(bSimple)
  })

  return ranked[0] ? simplifyCardName(ranked[0]) : ""
}

/** Parse ML Kit / Vision text lines into card name + collector number. */
export function parseOcrLines(lines: string[]): DetectedCard | null {
  const raw = lines.join("\n")
  const trimmedLines = lines.map((line) => line.trim()).filter(Boolean)
  if (!trimmedLines.length) return null

  let numberLineIndex = -1
  let cardNumber = ""

  for (let i = 0; i < trimmedLines.length; i += 1) {
    const found = extractCollectorNumberFromText(trimmedLines[i]!)
    if (found) {
      numberLineIndex = i
      cardNumber = found
      break
    }
  }

  if (!cardNumber) {
    cardNumber = extractCollectorNumberFromText(raw)
  }

  const cardName = pickCardName(trimmedLines, numberLineIndex)
  if (!cardName && !cardNumber) return null

  return {
    cardName,
    setName: "",
    cardNumber,
    confidence: cardName && cardNumber ? 0.86 : 0.55,
    notes: "native-ocr",
  }
}

export function hasOcrMatchFields(detected: DetectedCard | null | undefined): boolean {
  if (!detected) return false
  const name = simplifyCardName(detected.cardName).trim()
  const number = cleanNumber(detected.cardNumber)
  return name.length >= 3 && number.length >= 1
}
