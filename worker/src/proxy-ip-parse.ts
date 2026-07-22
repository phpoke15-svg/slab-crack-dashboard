export function parseIpFromBody(body: string): string | null {
  const trimmed = body.trim()
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(trimmed)) return trimmed

  try {
    const json = JSON.parse(trimmed) as { origin?: string }
    const origin = json.origin?.split(",")[0]?.trim()
    if (origin && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(origin)) return origin
  } catch {
    // plain-text fallback above
  }

  return null
}
