export type DetectedCard = {
  cardName: string
  setName: string
  cardNumber: string
  confidence: number
  notes?: string
}

export function cleanNumber(raw: string): string {
  const trimmed = raw.trim()
  const slash = trimmed.match(/^#?(\d{1,4})\s*\/\s*\d{1,4}$/)
  if (slash) return slash[1]!
  const bare = trimmed.match(/^#?(\d{1,4}[a-z]?)$/i)
  if (bare) return bare[1]!
  return trimmed.replace(/^#/, "").trim()
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
