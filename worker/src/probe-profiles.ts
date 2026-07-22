/** Rotate client fingerprints each cron tick — Imperva flags static bot headers. */
const ROTATING_PROFILES: Array<{ id: string; userAgent: string; acceptLanguage: string }> = [
  {
    id: "chrome-desktop-us",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    acceptLanguage: "en-US,en;q=0.9",
  },
  {
    id: "safari-ios",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    acceptLanguage: "en-US,en;q=0.9",
  },
  {
    id: "chrome-android",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    acceptLanguage: "en-US,en;q=0.9",
  },
  {
    id: "firefox-desktop",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    acceptLanguage: "en-US,en;q=0.8",
  },
]

export function pickProbeProfile(now = Date.now()): (typeof ROTATING_PROFILES)[number] {
  const slot = Math.floor(now / (5 * 60 * 1000)) % ROTATING_PROFILES.length
  return ROTATING_PROFILES[slot]!
}

export function buildProbeHeaders(profile: (typeof ROTATING_PROFILES)[number]): Record<string, string> {
  return {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": profile.acceptLanguage,
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": profile.userAgent,
  }
}
