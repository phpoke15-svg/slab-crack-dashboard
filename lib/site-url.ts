/** Canonical public site origin (no trailing slash). */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (raw) {
    try {
      const url = new URL(raw)
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin
      }
    } catch {
      // fall through
    }
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`
  }
  return "https://www.collectools.app"
}
