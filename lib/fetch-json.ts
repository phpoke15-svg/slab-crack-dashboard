/** Parse JSON from a fetch Response; returns null when body is HTML/plain text. */
export async function readResponseJson<T>(res: Response): Promise<T | null> {
  const text = await res.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export function fetchErrorMessage(
  res: Response,
  json: { error?: string } | null,
  fallback: string,
): string {
  if (json?.error) return json.error
  if (res.status >= 500) return "Server error — try again in a moment"
  if (res.status === 404) return "Not found"
  return fallback
}
