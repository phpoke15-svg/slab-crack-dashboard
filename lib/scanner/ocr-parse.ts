import { cleanNumber, simplifyCardName, type DetectedCard } from "@/lib/slabcrack/identify-parse"

const COLLECTOR_NUMBER_RE = /\b([a-z]{0,3}\d{1,4}[a-z]?)\s*\/\s*([a-z]{0,3}\d{1,4})\b/i
const NOISE_LINE_RE =
  /^(hp\b|weakness|resistance|retreat|pok[eé]mon|trainer|energy|illus|©|basic|stage|ability|attack|rarity|confetti)/i
const ATTACK_LINE_RE =
  /\b(damage|during your turn|your opponent|coin|tails|heads|bench|switch|attach|discard|draw|knock out)\b/i

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

/** Parse raw OCR text into a detected card (name + collector number). */
export function parseOcrText(raw: string): DetectedCard | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) return null

  let numberLineIndex = -1
  let cardNumber = ""

  for (let i = 0; i < lines.length; i += 1) {
    const found = extractCollectorNumberFromText(lines[i]!)
    if (found) {
      numberLineIndex = i
      cardNumber = found
      break
    }
  }

  if (!cardNumber) {
    cardNumber = extractCollectorNumberFromText(raw)
  }

  const cardName = pickCardName(lines, numberLineIndex)
  if (!cardName && !cardNumber) return null

  const confidence = cardName && cardNumber ? 0.82 : cardName || cardNumber ? 0.55 : 0.4

  return {
    cardName,
    setName: "",
    cardNumber,
    confidence,
    notes: "ocr",
  }
}

/** Merge targeted name/number strip reads with the full-card OCR pass. */
export function mergeOcrReads(
  full: DetectedCard | null,
  nameStrip: DetectedCard | null,
  numberStrip: DetectedCard | null,
): DetectedCard | null {
  const cardName =
    nameStrip?.cardName?.trim() ||
    full?.cardName?.trim() ||
    numberStrip?.cardName?.trim() ||
    ""
  const cardNumber =
    numberStrip?.cardNumber?.trim() ||
    full?.cardNumber?.trim() ||
    nameStrip?.cardNumber?.trim() ||
    ""

  if (!cardName && !cardNumber) return null

  const confidence = Math.max(
    full?.confidence ?? 0,
    nameStrip?.confidence ?? 0,
    numberStrip?.confidence ?? 0,
    cardName && cardNumber ? 0.86 : 0.5,
  )

  return {
    cardName,
    setName: "",
    cardNumber,
    confidence,
    notes: "ocr",
  }
}

/** Only skip vision when OCR read both fields with reasonable confidence. */
export function shouldTrustOcrDetected(detected: DetectedCard | null | undefined): boolean {
  if (!detected) return false
  const name = detected.cardName.trim()
  const number = detected.cardNumber.trim()
  if (name && number) return detected.confidence >= 0.72
  if (name || number) return detected.confidence >= 0.85
  return false
}
