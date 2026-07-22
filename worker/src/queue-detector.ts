const QUEUE_HOST_PATTERNS = [/queue\.pokemoncenter\.com/i, /queue-it\.net/i, /queue-it\.com/i]

export type HeadProbeResult = {
  status: number
  location: string | null
  live: boolean
  queueUrl: string | null
}

export function isQueueRedirectLocation(location: string | null | undefined): boolean {
  if (!location) return false
  try {
    const url = new URL(location, "https://www.pokemoncenter.com")
    return QUEUE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))
  } catch {
    return QUEUE_HOST_PATTERNS.some((pattern) => pattern.test(location))
  }
}

export function analyzeHeadResponse(status: number, location: string | null | undefined): HeadProbeResult {
  const redirect = status === 302 || status === 307
  const queueLive = redirect && isQueueRedirectLocation(location)
  const queueUrl = queueLive && location ? location : null

  return {
    status,
    location: location ?? null,
    live: queueLive,
    queueUrl,
  }
}

export type LiveDebounceState = {
  consecutiveLive: number
  windowStartedAt: number | null
  lastAlertAt: number | null
}

export const CRON_SCHEDULE = "*/5 * 9-16 * * 1-5"
export const CRON_TIMEZONE = "America/New_York"
/** Two consecutive cron ticks (every 5 min) must fall inside this window. */
export const DEBOUNCE_WINDOW_MS = 11 * 60 * 1000
export const DEBOUNCE_REQUIRED_HITS = 2
export const ALERT_COOLDOWN_MS = 5 * 60 * 1000

export function createDebounceState(): LiveDebounceState {
  return { consecutiveLive: 0, windowStartedAt: null, lastAlertAt: null }
}

/** Returns true when two consecutive LIVE hits occur within the debounce window. */
export function registerLiveHit(state: LiveDebounceState, now = Date.now()): boolean {
  if (state.windowStartedAt != null && now - state.windowStartedAt > DEBOUNCE_WINDOW_MS) {
    state.consecutiveLive = 0
    state.windowStartedAt = null
  }

  state.consecutiveLive += 1
  state.windowStartedAt = state.windowStartedAt ?? now

  return state.consecutiveLive >= DEBOUNCE_REQUIRED_HITS
}

export function resetLiveDebounce(state: LiveDebounceState): void {
  state.consecutiveLive = 0
  state.windowStartedAt = null
}

export function canSendAlert(state: LiveDebounceState, now = Date.now()): boolean {
  if (state.lastAlertAt == null) return true
  return now - state.lastAlertAt >= ALERT_COOLDOWN_MS
}

export function markAlertSent(state: LiveDebounceState, now = Date.now()): void {
  state.lastAlertAt = now
}
