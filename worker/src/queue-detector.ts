const QUEUE_HOST_PATTERNS = [/queue\.pokemoncenter\.com/i, /queue-it\.net/i, /queue-it\.com/i]
const QUEUE_REDIRECT_RE = /queue-it|waitingroom|waiting-room|queueit|virtual.?queue/i
const QUEUE_HEADER_RE = /queue-it|queueit|x-queue/i
const IMPERVA_BLOCK_RE =
  /access denied|request unsuccessful|are you human|verify you are human|_Incapsula_Resource[\s\S]{0,400}incident_id=/i

export type HeadProbeResult = {
  status: number
  location: string | null
  live: boolean
  queueUrl: string | null
  blocked: boolean
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

function hasQueueHeader(headers: Record<string, string> | undefined): boolean {
  if (!headers) return false
  for (const [key, value] of Object.entries(headers)) {
    if (QUEUE_HEADER_RE.test(`${key}:${value}`)) return true
  }
  return false
}

function hasQueueHtml(html: string | null | undefined): boolean {
  if (!html) return false
  return QUEUE_REDIRECT_RE.test(html)
}

export function analyzeHeadResponse(
  status: number,
  location: string | null | undefined,
  options?: { headers?: Record<string, string>; html?: string | null },
): HeadProbeResult {
  const headers = options?.headers
  const html = options?.html ?? null
  const redirect = status === 301 || status === 302 || status === 307 || status === 308
  const redirectQueue = redirect && isQueueRedirectLocation(location)
  const headerQueue = hasQueueHeader(headers)
  const htmlQueue = !redirectQueue && hasQueueHtml(html)
  const blocked =
    status === 403 ||
    IMPERVA_BLOCK_RE.test(html ?? "") ||
    (status === 503 && IMPERVA_BLOCK_RE.test(html ?? ""))

  const queueLive = !blocked && (redirectQueue || headerQueue || htmlQueue)
  const queueUrl =
    redirectQueue && location
      ? location
      : htmlQueue && location
        ? location
        : queueLive
          ? "https://www.pokemoncenter.com/"
          : null

  return {
    status,
    location: location ?? null,
    live: queueLive,
    queueUrl,
    blocked,
  }
}

export type LiveDebounceState = {
  consecutiveLive: number
  windowStartedAt: number | null
  lastAlertAt: number | null
}

/** 6-field cron (sec min hour dom month dow): every 3 minutes on weekdays; window guarded in code. */
export const CHECK_INTERVAL_MS = 180_000
export const CRON_SCHEDULE = "0 */3 * * * 1-5"
export const CRON_TIMEZONE = "America/New_York"
export const MONITORING_WINDOW_LABEL = "M-F 9:30am-4:00pm ET"
export const MONITORING_START_MINUTES = 9 * 60 + 30
export const MONITORING_END_MINUTES = 16 * 60
/** Two consecutive LIVE checks must fall inside this window (fits 3-minute polling). */
export const DEBOUNCE_WINDOW_MS = 7 * 60 * 1000
export const DEBOUNCE_REQUIRED_HITS = 2
export const ALERT_COOLDOWN_MS = 5 * 60 * 1000

type EasternClock = {
  day: number
  hour: number
  minute: number
}

const WEEKDAY_TO_DAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function getEasternClock(now = new Date()): EasternClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CRON_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now)

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun"
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0")

  return { day: WEEKDAY_TO_DAY[weekday] ?? 0, hour, minute }
}

/** Mon–Fri 9:30 AM through 4:00 PM Eastern (4:00 PM exclusive). */
export function isWithinMonitoringWindow(now = new Date()): boolean {
  const { day, hour, minute } = getEasternClock(now)
  if (day === 0 || day === 6) return false

  const totalMinutes = hour * 60 + minute
  return totalMinutes >= MONITORING_START_MINUTES && totalMinutes < MONITORING_END_MINUTES
}

export const OUTSIDE_MONITORING_WINDOW_MESSAGE =
  `[worker] Outside operating window (${MONITORING_WINDOW_LABEL}). Skipping check...`

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
