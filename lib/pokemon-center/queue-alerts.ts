import type { QueueDetection } from "@/lib/pokemon-center/queue-detector"
import { hasImpervaChallengeSignals } from "@/lib/pokemon-center/queue-detector"
import { maybeSendNtfyAlert } from "@/lib/pokemon-center/ntfy-alerts"
import {
  claimPushAlertDedupe,
  recordPushAlertDedupe,
  releasePushAlertDedupe,
  sendWebPushToTopic,
  wasGlobalPushSentRecently,
} from "@/lib/push/web-push"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { getSiteUrl } from "@/lib/site-url"
import { POKEMON_CENTER_HOME_URL } from "@/lib/pokemon-center/constants"

export type QueueWatchReport = {
  sessionId: string
  live: boolean
  confidence: number
  signals: QueueDetection["signals"]
  source: "bookmarklet" | "server" | "local" | "mobile"
  pageUrl?: string
  reportedAt: string
  ntfyTopic?: string
  userId?: string
}

const memoryReports = new Map<string, QueueWatchReport>()
const memoryByUser = new Map<string, QueueWatchReport>()
const lastDiscordAt = new Map<string, number>()

const DISCORD_COOLDOWN_MS = 5 * 60 * 1000
const PUSH_COOLDOWN_MS = 5 * 60 * 1000
const CHALLENGE_PUSH_COOLDOWN_MS = 30 * 60 * 1000

function reportHasChallenge(report: QueueWatchReport): boolean {
  return hasImpervaChallengeSignals(report.signals)
}

function rowToReport(data: {
  session_id: string
  live: boolean
  confidence: number
  signals: unknown
  page_url: string | null
  reported_at: string
  user_id?: string | null
}): QueueWatchReport {
  return {
    sessionId: data.session_id,
    live: data.live,
    confidence: data.confidence,
    signals: Array.isArray(data.signals) ? data.signals : [],
    source: "bookmarklet",
    pageUrl: data.page_url ?? undefined,
    reportedAt: data.reported_at,
    userId: data.user_id ?? undefined,
  }
}

export async function saveQueueWatchReport(
  report: QueueWatchReport,
): Promise<{ ok: true } | { ok: false; error: string }> {
  memoryReports.set(report.sessionId, report)
  if (report.userId) memoryByUser.set(report.userId, report)

  if (!isSupabaseConfigured()) {
    // Local/dev single process — memory is enough. Vercel always has Supabase.
    return { ok: true }
  }

  try {
    const supabase = createAdminClient()
    const baseRow = {
      session_id: report.sessionId,
      live: report.live,
      confidence: report.confidence,
      signals: report.signals,
      page_url: report.pageUrl ?? null,
      reported_at: report.reportedAt,
    }

    const withUser = report.userId ? { ...baseRow, user_id: report.userId } : baseRow
    const first = await supabase.from("queue_watch_reports").upsert(withUser)

    if (first.error && report.userId) {
      // Older schema without user_id — still persist the ping.
      const fallback = await supabase.from("queue_watch_reports").upsert(baseRow)
      if (fallback.error) {
        console.error("[queue-watch] persist failed:", fallback.error.message)
        return { ok: false, error: fallback.error.message }
      }
      return { ok: true }
    }

    if (first.error) {
      console.error("[queue-watch] persist failed:", first.error.message)
      return { ok: false, error: first.error.message }
    }

    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save report"
    console.error("[queue-watch] persist exception:", message)
    return { ok: false, error: message }
  }
}

export async function getQueueWatchReport(sessionId: string): Promise<QueueWatchReport | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from("queue_watch_reports")
        .select("session_id, live, confidence, signals, page_url, reported_at, user_id")
        .eq("session_id", sessionId)
        .maybeSingle()

      if (!error && data) return rowToReport(data)

      // Older schema without user_id
      if (error) {
        const retry = await supabase
          .from("queue_watch_reports")
          .select("session_id, live, confidence, signals, page_url, reported_at")
          .eq("session_id", sessionId)
          .maybeSingle()
        if (!retry.error && retry.data) return rowToReport({ ...retry.data, user_id: null })
      }
    } catch {
      // fall through to memory
    }
  }

  return memoryReports.get(sessionId) ?? null
}

/** Latest report for a Pro user — survives bookmarklet/sessionId mismatches. */
export async function getLatestQueueWatchReportForUser(
  userId: string,
): Promise<QueueWatchReport | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from("queue_watch_reports")
        .select("session_id, live, confidence, signals, page_url, reported_at, user_id")
        .eq("user_id", userId)
        .order("reported_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!error && data) return rowToReport(data)
    } catch {
      // fall through
    }
  }

  return memoryByUser.get(userId) ?? null
}

export async function isQueueWatchReportsTableReady(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from("queue_watch_reports").select("session_id").limit(1)
    return !error
  } catch {
    return false
  }
}

export async function maybeSendDiscordAlert(report: QueueWatchReport): Promise<boolean> {
  if (!report.live) return false

  const webhook = process.env.POKEMON_CENTER_DISCORD_WEBHOOK?.trim()
  if (!webhook) return false

  const key = `${report.sessionId}:${report.live}`
  const last = lastDiscordAt.get(key) ?? 0
  if (Date.now() - last < DISCORD_COOLDOWN_MS) return false

  const signalSummary =
    report.signals.length > 0
      ? report.signals.map((s) => s.label).join(", ")
      : "Queue activity detected"

  const payload = {
    content: [
      "@everyone **Pokemon Center queue is LIVE**",
      signalSummary,
      report.pageUrl ? `<${report.pageUrl}>` : "https://www.pokemoncenter.com/",
      `_Reported ${new Date(report.reportedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} ET_`,
    ].join("\n"),
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) return false
  lastDiscordAt.set(key, Date.now())
  return true
}

async function maybeSendChallengeDiscordAlert(report: QueueWatchReport): Promise<boolean> {
  if (!reportHasChallenge(report)) return false

  const webhook = process.env.POKEMON_CENTER_DISCORD_WEBHOOK?.trim()
  if (!webhook) return false

  const key = `${report.sessionId}:challenge`
  const last = lastDiscordAt.get(key) ?? 0
  if (Date.now() - last < DISCORD_COOLDOWN_MS) return false

  const signalSummary =
    report.signals.length > 0
      ? report.signals.map((s) => s.label).join(", ")
      : "Imperva human verification detected"

  const payload = {
    content: [
      "@everyone **Pokemon Center drop guard is UP**",
      "Imperva human verification (checkbox / image CAPTCHA) — open Pokemon Center now.",
      signalSummary,
      report.pageUrl ? `<${report.pageUrl}>` : "https://www.pokemoncenter.com/",
      `_Reported ${new Date(report.reportedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} ET_`,
    ].join("\n"),
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) return false
  lastDiscordAt.set(key, Date.now())
  return true
}

async function maybeSendChallengeWebPush(
  report: QueueWatchReport,
): Promise<{ sent: boolean; reason?: string }> {
  if (!reportHasChallenge(report)) {
    return { sent: false, reason: "no_challenge_signals" }
  }

  const claimed = await claimPushAlertDedupe("imperva_challenge_global", CHALLENGE_PUSH_COOLDOWN_MS)
  if (!claimed) return { sent: false, reason: "deduped" }

  const site = getSiteUrl()
  const result = await sendWebPushToTopic("queue_live", {
    title: "Pokémon Center drop guard is UP",
    body: "Imperva human verification detected — open your browser, go to pokemoncenter.com, and pass the check now.",
    url: `${site}/pokewatch`,
    tag: "pc-imperva-challenge",
  })

  if (result.sent === 0) {
    await releasePushAlertDedupe("imperva_challenge_global")
    console.error("[queue-watch] challenge push not delivered:", result.reason, result)
    return { sent: false, reason: result.reason || "send_failed" }
  }

  await recordPushAlertDedupe("imperva_challenge_global")
  return { sent: true }
}

async function maybeSendQueueLiveWebPush(
  report: QueueWatchReport,
): Promise<{ sent: boolean; reason?: string }> {
  if (!report.live) return { sent: false, reason: "not_live" }

  const claimed = await claimPushAlertDedupe("queue_live_global", PUSH_COOLDOWN_MS)
  if (!claimed) return { sent: false, reason: "deduped" }

  const site = getSiteUrl()

  const result = await sendWebPushToTopic("queue_live", {
    title: "🚨 Pokémon Center Queue is LIVE!",
    body: "Tap to open your browser and tap your Queue Watcher bookmark on pokemoncenter.com.",
    url: `${site}/pokewatch`,
    tag: "pc-queue-live",
  })

  if (result.sent === 0) {
    await releasePushAlertDedupe("queue_live_global")
    console.error("[queue-watch] queue-live push not delivered:", result.reason, result)
    return { sent: false, reason: result.reason || "send_failed" }
  }

  await recordPushAlertDedupe("queue_live_global")
  return { sent: true }
}

/** Manual test hook for Pro/Supreme web push on /pokewatch (CRON_SECRET). */
export async function sendTestQueueLiveWebPush(options?: {
  force?: boolean
  targetUrl?: string
}): Promise<{ sent: boolean; reason?: string; sentCount?: number; targetUrl?: string }> {
  if (!options?.force) {
    const claimed = await claimPushAlertDedupe("queue_live_global", PUSH_COOLDOWN_MS)
    if (!claimed) return { sent: false, reason: "deduped" }
  }

  const targetUrl = options?.targetUrl?.trim() || POKEMON_CENTER_HOME_URL
  const result = await sendWebPushToTopic("queue_live", {
    title: "🚨 Pokémon Center Queue is LIVE! (TEST)",
    body: "Tap to open pokemoncenter.com — this is a CollecTools test alert.",
    url: targetUrl,
    tag: "pc-queue-live-test",
  })

  if (result.sent === 0) {
    if (!options?.force) {
      await releasePushAlertDedupe("queue_live_global")
    }
    return { sent: false, reason: result.reason || "send_failed", sentCount: 0, targetUrl }
  }

  if (!options?.force) {
    await recordPushAlertDedupe("queue_live_global")
  }

  return { sent: true, sentCount: result.sent, targetUrl }
}

export async function maybeSendMobileAlerts(
  report: QueueWatchReport,
  previous: QueueWatchReport | null,
): Promise<{
  discordSent: boolean
  ntfySent: boolean
  pushSent: boolean
  challengePushSent: boolean
  pushReason?: string
  challengePushReason?: string
}> {
  const hadChallenge = previous ? reportHasChallenge(previous) : false
  const challengePresent = reportHasChallenge(report)
  const challengeEdge =
    challengePresent &&
    (!hadChallenge ||
      !(await wasGlobalPushSentRecently("imperva_challenge_global", CHALLENGE_PUSH_COOLDOWN_MS)))

  const liveEdge =
    report.live &&
    (!previous?.live ||
      !(await wasGlobalPushSentRecently("queue_live_global", PUSH_COOLDOWN_MS)))

  if (!challengeEdge && !liveEdge) {
    return {
      discordSent: false,
      ntfySent: false,
      pushSent: false,
      challengePushSent: false,
      pushReason: report.live ? "deduped_or_no_edge" : undefined,
      challengePushReason: challengePresent ? "deduped_or_no_edge" : undefined,
    }
  }

  const [challengeDiscord, liveDiscord, ntfySent, challengePush, livePush] = await Promise.all([
    challengeEdge ? maybeSendChallengeDiscordAlert(report) : Promise.resolve(false),
    liveEdge ? maybeSendDiscordAlert(report) : Promise.resolve(false),
    liveEdge && report.ntfyTopic
      ? maybeSendNtfyAlert({
          topic: report.ntfyTopic,
          live: true,
          signals: report.signals,
          pageUrl: report.pageUrl,
        })
      : Promise.resolve(false),
    challengeEdge ? maybeSendChallengeWebPush(report) : Promise.resolve({ sent: false }),
    liveEdge ? maybeSendQueueLiveWebPush(report) : Promise.resolve({ sent: false }),
  ])

  return {
    discordSent: challengeDiscord || liveDiscord,
    ntfySent,
    pushSent: livePush.sent,
    challengePushSent: challengePush.sent,
    pushReason: livePush.reason,
    challengePushReason: challengePush.reason,
  }
}
