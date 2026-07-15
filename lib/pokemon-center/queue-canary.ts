import {
  detectQueueFromContent,
  type QueueDetection,
  type QueueSignal,
} from "@/lib/pokemon-center/queue-detector"

export type QueueCanaryResult = QueueDetection & {
  statusCode: number
  redirectUrl?: string
  probeProfile: string
}

/** Rotate client fingerprints each cron tick (low-frequency canary). */
const ROTATING_PROFILES: Array<{ id: string; userAgent: string; acceptLanguage: string }> = [
  {
    id: "chrome-desktop-us",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
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
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
    acceptLanguage: "en-US,en;q=0.9",
  },
  {
    id: "firefox-desktop",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    acceptLanguage: "en-US,en;q=0.8",
  },
]

const QUEUE_REDIRECT_RE = /queue-it|waitingroom|waiting-room|queueit|virtual.?queue/i
const QUEUE_HEADER_RE = /queue-it|queueit|x-queue/i

function pickProfile(): (typeof ROTATING_PROFILES)[number] {
  const slot = Math.floor(Date.now() / (5 * 60 * 1000)) % ROTATING_PROFILES.length
  return ROTATING_PROFILES[slot]!
}

function signalsFromRedirect(location: string): QueueSignal[] {
  if (!location) return []
  return [
    {
      id: "canary-redirect",
      label: `Queue redirect (${location.slice(0, 80)})`,
      confidence: 100,
    },
  ]
}

function signalsFromHeaders(headers: Headers): QueueSignal[] {
  const hits: QueueSignal[] = []
  for (const [key, value] of headers.entries()) {
    if (QUEUE_HEADER_RE.test(`${key}:${value}`)) {
      hits.push({
        id: "canary-queue-header",
        label: `Queue header (${key})`,
        confidence: 95,
      })
      break
    }
  }
  return hits
}

/**
 * Lightweight canary probe — manual redirect handling + header scan.
 * Imperva often blocks datacenter IPs; optional QUEUE_CANARY_PROXY_URL for residential egress.
 */
export async function probePokemonCenterQueueCanary(): Promise<QueueCanaryResult> {
  const profile = pickProfile()
  const checkedAt = new Date().toISOString()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  const headers: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": profile.acceptLanguage,
    "User-Agent": profile.userAgent,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  }

  const proxyUrl = process.env.QUEUE_CANARY_PROXY_URL?.trim()
  if (proxyUrl) {
    headers["X-Canary-Proxy"] = "1"
  }

  try {
    const response = await fetch("https://www.pokemoncenter.com/", {
      method: "GET",
      redirect: "manual",
      headers,
      signal: controller.signal,
      cache: "no-store",
    })

    const location = response.headers.get("location") ?? ""
    const headerSignals = signalsFromHeaders(response.headers)
    const redirectQueue = QUEUE_REDIRECT_RE.test(location)
    const redirectSignals = redirectQueue ? signalsFromRedirect(location) : []

    let html = ""
    if (response.status >= 200 && response.status < 300) {
      html = await response.text()
    }

    const blocked =
      response.status === 403 ||
      /access denied|request unsuccessful/i.test(html) ||
      /_Incapsula_Resource[\s\S]{0,400}incident_id=/i.test(html)

    const content = detectQueueFromContent({
      html,
      url: location || response.url,
      blocked,
    })

    const mergedSignals = [...redirectSignals, ...headerSignals, ...content.signals]
    const queueSignals = mergedSignals.filter((s) => s.confidence > 0)
    const confidence = queueSignals.reduce((max, s) => Math.max(max, s.confidence), 0)
    const live = redirectQueue || headerSignals.length > 0 || content.live

    return {
      live: blocked ? false : live,
      confidence: blocked ? 0 : Math.max(confidence, content.confidence),
      signals: mergedSignals,
      blocked,
      challenge: content.challenge,
      finalUrl: location || response.url,
      redirectUrl: location || undefined,
      statusCode: response.status,
      checkedAt,
      probeProfile: profile.id,
    }
  } catch {
    return {
      live: false,
      confidence: 0,
      signals: [{ id: "canary-error", label: "Canary probe failed", confidence: 0 }],
      blocked: true,
      statusCode: 0,
      checkedAt,
      probeProfile: profile.id,
    }
  } finally {
    clearTimeout(timeout)
  }
}
