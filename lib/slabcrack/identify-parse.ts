export type DetectedCard = {
  cardName: string
  setName: string
  cardNumber: string
  confidence: number
  notes?: string
}

/** Normalize collector numbers: 025→25, 161/131→161, TG01→TG1, GG70→GG70. */
export function cleanNumber(raw: string): string {
  const trimmed = raw.trim().replace(/^#/, "")
  if (!trimmed) return ""

  const slash = trimmed.match(/^([a-z]{0,3}\d{1,4}[a-z]?)\s*\/\s*\d{1,4}$/i)
  if (slash) return normalizeCollectorToken(slash[1]!)

  const prefixed = trimmed.match(/^([a-z]{1,3})0*(\d{1,4}[a-z]?)$/i)
  if (prefixed) {
    return `${prefixed[1]!.toUpperCase()}${normalizeCollectorToken(prefixed[2]!)}`
  }

  const bare = trimmed.match(/^(\d{1,4}[a-z]?)$/i)
  if (bare) return normalizeCollectorToken(bare[1]!)

  return trimmed
}

function normalizeCollectorToken(token: string): string {
  return token.replace(/^0+(?=\d)/, "")
}

/** Strip rarity fluff Gemini often appends so catalog search can match. */
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

/** Strip markdown fences / leading chatter so Gemini JSON still parses. */
export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed

  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)

  return trimmed
}

export function parseDetectedJson(raw: string, provider: string): DetectedCard {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>
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

type GeminiPart = {
  text?: string
  thought?: boolean
}

type GeminiCandidate = {
  finishReason?: string
  content?: {
    parts?: GeminiPart[]
  }
}

export type GeminiGenerateResponse = {
  candidates?: GeminiCandidate[]
  promptFeedback?: {
    blockReason?: string
  }
}

/** Prefer non-thought answer text; fall back to any text if the API only returns thoughts. */
export function extractGeminiAnswerText(json: GeminiGenerateResponse): {
  text: string
  finishReason?: string
  blockReason?: string
} {
  const blockReason = json.promptFeedback?.blockReason
  const candidate = json.candidates?.[0]
  const finishReason = candidate?.finishReason
  const parts = candidate?.content?.parts ?? []

  const answer = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim()
  if (answer) return { text: answer, finishReason, blockReason }

  // Some responses put usable JSON only in thought parts or omit the flag.
  const anyText = parts
    .map((p) => p.text ?? "")
    .join("")
    .trim()
  return { text: anyText, finishReason, blockReason }
}

export function thinkingConfigForModel(model: string): Record<string, unknown> | null {
  const id = model.toLowerCase()
  // Gemini 2.5 uses thinkingBudget; 0 disables thinking on Flash.
  if (id.includes("2.5")) {
    return { thinkingBudget: 0 }
  }
  // Gemini 3.x uses thinkingLevel (lowercase enum values in REST).
  if (id.includes("3.") || id.includes("3-")) {
    return { thinkingLevel: "minimal" }
  }
  return null
}

export type ScoreableHit = {
  cardName: string
  setName: string
  cardNumber: string
}

export function scoreHit(hit: ScoreableHit, detected: DetectedCard): number {
  const name = simplifyCardName(detected.cardName).toLowerCase()
  const setName = detected.setName.toLowerCase()
  const number = cleanNumber(detected.cardNumber).toLowerCase()
  const hitName = hit.cardName.toLowerCase()
  const hitSet = hit.setName.toLowerCase()
  const hitNum = cleanNumber(hit.cardNumber.split("/")[0] ?? "").toLowerCase()

  let score = 0
  if (number && hitNum && number === hitNum) score += 50
  else if (number && hitNum && (hitNum.includes(number) || number.includes(hitNum))) score += 20

  if (name && hitName) {
    if (hitName.includes(name) || name.includes(hitName)) score += 35
    else {
      const first = name.split(/\s+/).find((t) => t.length > 2) ?? ""
      if (first && hitName.includes(first)) score += 15
    }
  }

  if (setName && hitSet.includes(setName)) score += 20
  else if (setName) {
    const token = setName.split(/\s+/).find((t) => t.length > 3)
    if (token && hitSet.includes(token.toLowerCase())) score += 10
  }

  return score
}

/** Minimum score before auto-opening HUD (avoids wrong-card "success"). */
export function minAutoMatchScore(detected: DetectedCard): number {
  if (cleanNumber(detected.cardNumber)) return 50
  if (detected.setName.trim()) return 45
  return 35
}
