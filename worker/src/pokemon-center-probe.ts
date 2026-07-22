import { gotScraping } from "got-scraping"
import { buildProxyUrl, config } from "./config.js"
import { analyzeHeadResponse, type HeadProbeResult } from "./queue-detector.js"

export type PokemonCenterProbeResult = HeadProbeResult & {
  transport: "got-scraping"
  profile: string
}

const PROBE_PROFILE = "firefox-desktop"

const scrapingClient = gotScraping.extend({
  useHeaderGenerator: true,
  headerGeneratorOptions: {
    browsers: [
      { name: "firefox", minVersion: 120, maxVersion: 135 },
      { name: "chrome", minVersion: 120, maxVersion: 135 },
    ],
    devices: ["desktop"],
    locales: ["en-US"],
    operatingSystems: ["windows"],
  },
  http2: true,
  timeout: { request: 15_000 },
  retry: { limit: 0 },
  followRedirect: false,
  throwHttpErrors: false,
})

function normalizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue
    normalized[key.toLowerCase()] = Array.isArray(value) ? value[0]! : value
  }
  return normalized
}

/** Probe Pokémon Center through IPRoyal with browser-like TLS + headers via got-scraping. */
export async function probePokemonCenterQueue(): Promise<PokemonCenterProbeResult> {
  const proxyUrl = buildProxyUrl()

  const response = await scrapingClient.get({
    url: config.targetUrl,
    proxyUrl,
  })

  const location = response.headers.location ?? null
  const html = typeof response.body === "string" ? response.body.slice(0, 8192) : null
  const probe = analyzeHeadResponse(response.statusCode, location, {
    headers: normalizeHeaders(response.headers),
    html,
  })

  return {
    ...probe,
    transport: "got-scraping",
    profile: PROBE_PROFILE,
  }
}

export function formatProbeLogLine(probe: PokemonCenterProbeResult): string {
  const blockedNote = probe.blocked ? " blocked=Imperva" : ""
  return (
    `[worker] GET ${config.targetUrl} -> ${probe.status} transport=${probe.transport} profile=${probe.profile}` +
    (probe.location ? ` location=${probe.location}` : "") +
    (probe.live ? " LIVE" : "") +
    blockedNote
  )
}

export function formatProbeError(error: unknown): string {
  if (error instanceof Error) {
    const code = "code" in error ? String((error as NodeJS.ErrnoException).code) : ""
    return code ? `${error.message} (${code})` : error.message
  }
  return String(error)
}
