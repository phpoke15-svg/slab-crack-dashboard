/**
 * Preferred Gemini vision model cascade for Scan / Binder HUD.
 *
 * Prefer current Flash stable IDs first — some API keys (especially newer projects)
 * return 404 "no longer available / update to newest version" for gemini-2.5-flash.
 */
export function geminiVisionModelCandidates(configured?: string | null): string[] {
  const preferred = (configured || process.env.GEMINI_VISION_MODEL || "").trim()
  const defaults = [
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
  ]
  return [preferred, ...defaults].filter(
    (m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i,
  )
}

/** True when Gemini says this model id is gone / unavailable for the key. */
export function isGeminiModelUnavailable(status: number, body: string): boolean {
  if (status === 404) return true
  return /no longer available|not found|not supported|update your code to use a newer model|update to newest/i.test(
    body,
  )
}
