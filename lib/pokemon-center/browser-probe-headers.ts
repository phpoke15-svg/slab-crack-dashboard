export type BrowserProbeProfile = {
  id: string
  userAgent: string
  acceptLanguage: string
  accept: string
  acceptEncoding: string
  secFetchSite: "none" | "same-origin" | "cross-site"
  secChUa?: string
  secChUaMobile?: string
  secChUaPlatform?: string
}

/** Rotate client fingerprints — Imperva flags static bot headers. */
export const BROWSER_PROBE_PROFILES: BrowserProbeProfile[] = [
  {
    id: "chrome-desktop-us",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    acceptLanguage: "en-US,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    acceptEncoding: "gzip, deflate, br, zstd",
    secFetchSite: "none",
    secChUa: `"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`,
    secChUaMobile: "?0",
    secChUaPlatform: `"Windows"`,
  },
  {
    id: "chrome-android",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    acceptLanguage: "en-US,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    acceptEncoding: "gzip, deflate, br, zstd",
    secFetchSite: "none",
    secChUa: `"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`,
    secChUaMobile: "?1",
    secChUaPlatform: `"Android"`,
  },
  {
    id: "safari-ios",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    acceptLanguage: "en-US,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    acceptEncoding: "gzip, deflate, br",
    secFetchSite: "none",
  },
  {
    id: "firefox-desktop",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
    acceptLanguage: "en-US,en;q=0.8",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    acceptEncoding: "gzip, deflate, br, zstd",
    secFetchSite: "none",
  },
]

export function pickBrowserProbeProfile(now = Date.now()): BrowserProbeProfile {
  const slot = Math.floor(now / (5 * 60 * 1000)) % BROWSER_PROBE_PROFILES.length
  return BROWSER_PROBE_PROFILES[slot]!
}

/** Headers aligned with a real modern browser navigation to pokemoncenter.com. */
export function buildBrowserProbeHeaders(profile: BrowserProbeProfile): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: profile.accept,
    "Accept-Language": profile.acceptLanguage,
    "Accept-Encoding": profile.acceptEncoding,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": profile.secFetchSite,
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": profile.userAgent,
  }

  if (profile.secChUa) headers["sec-ch-ua"] = profile.secChUa
  if (profile.secChUaMobile) headers["sec-ch-ua-mobile"] = profile.secChUaMobile
  if (profile.secChUaPlatform) headers["sec-ch-ua-platform"] = profile.secChUaPlatform

  return headers
}
