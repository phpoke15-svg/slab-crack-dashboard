import type { QueueDetection } from "@/lib/pokemon-center/queue-detector"
import { maybeSendNtfyAlert } from "@/lib/pokemon-center/ntfy-alerts"
import {
  claimPushAlertDedupe,
  sendWebPushToTopic,
} from "@/lib/push/web-push"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"

export type QueueWatchReport = {
  sessionId: string
  live: boolean
  confidence: number
  signals: QueueDetection["signals"]
  source: "bookmarklet" | "server" | "local" | "mobile"
  pageUrl?: string
  reportedAt: string
  ntfyTopic?: string
}

const memoryReports = new Map<string, QueueWatchReport>()
const lastDiscordAt = new Map<string, number>()

const DISCORD_COOLDOWN_MS = 5 * 60 * 1000
const PUSH_COOLDOWN_MS = 5 * 60 * 1000

export async function saveQueueWatchReport(report: QueueWatchReport) {
  memoryReports.set(report.sessionId, report)

  if (!isSupabaseConfigured()) return

  try {
    const supabase = createAdminClient()
    await supabase.from("queue_watch_reports").upsert({
      session_id: report.sessionId,
      live: report.live,
      confidence: report.confidence,
      signals: report.signals,
      page_url: report.pageUrl ?? null,
      reported_at: report.reportedAt,
    })
  } catch {
    // Table may not exist yet; memory fallback still works on warm instances.
  }
}

export async function getQueueWatchReport(sessionId: string): Promise<QueueWatchReport | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from("queue_watch_reports")
        .select("session_id, live, confidence, signals, page_url, reported_at")
        .eq("session_id", sessionId)
        .maybeSingle()

      if (data) {
        return {
          sessionId: data.session_id,
          live: data.live,
          confidence: data.confidence,
          signals: Array.isArray(data.signals) ? data.signals : [],
          source: "bookmarklet",
          pageUrl: data.page_url ?? undefined,
          reportedAt: data.reported_at,
        }
      }
    } catch {
      // fall through to memory
    }
  }

  return memoryReports.get(sessionId) ?? null
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

async function maybeSendQueueLiveWebPush(report: QueueWatchReport): Promise<boolean> {
  if (!report.live) return false

  const claimed = await claimPushAlertDedupe("queue_live_global", PUSH_COOLDOWN_MS)
  if (!claimed) return false

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, "") ||
    "https://slab-crack-dashboard.vercel.app"

  const signalSummary =
    report.signals.length > 0
      ? report.signals.map((s) => s.label).join(", ")
      : "Queue activity detected"

  const result = await sendWebPushToTopic("queue_live", {
    title: "Pokémon Center queue is LIVE",
    body: signalSummary,
    url: `${site}/queue-watch`,
    tag: "pc-queue-live",
  })

  return result.sent > 0
}

export async function maybeSendMobileAlerts(
  report: QueueWatchReport,
  previous: QueueWatchReport | null,
): Promise<{ discordSent: boolean; ntfySent: boolean; pushSent: boolean }> {
  if (!report.live || previous?.live) {
    return { discordSent: false, ntfySent: false, pushSent: false }
  }

  const [discordSent, ntfySent, pushSent] = await Promise.all([
    maybeSendDiscordAlert(report),
    report.ntfyTopic
      ? maybeSendNtfyAlert({
          topic: report.ntfyTopic,
          live: true,
          signals: report.signals,
          pageUrl: report.pageUrl,
        })
      : Promise.resolve(false),
    maybeSendQueueLiveWebPush(report),
  ])

  return { discordSent, ntfySent, pushSent }
}
