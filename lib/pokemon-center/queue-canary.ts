import {
  buildBrowserProbeHeaders,
  pickBrowserProbeProfile,
} from "@/lib/pokemon-center/browser-probe-headers"
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
const QUEUE_REDIRECT_RE = /queue-it|waitingroom|waiting-room|queueit|virtual.?queue/i
const QUEUE_HEADER_RE = /queue-it|queueit|x-queue/i

function pickProfile() {
  return pickBrowserProbeProfile()
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

  const headers: Record<string, string> = buildBrowserProbeHeaders(profile)

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
