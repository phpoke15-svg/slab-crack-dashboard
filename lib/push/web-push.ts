import webpush from "web-push"
import { requireQueueWatchAccess } from "@/lib/billing/stripe"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"

export type PushTopic = "queue_live" | "walmart_wednesday"

export type PushSubscriptionRecord = {
  endpoint: string
  p256dh: string
  auth: string
  userId?: string | null
  queueLive: boolean
  walmartWednesday: boolean
}

export type PushPayload = {
  title: string
  body: string
  url: string
  tag?: string
}

const memorySubs = new Map<string, PushSubscriptionRecord>()
const memoryDedupe = new Map<string, number>()

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.VAPID_SUBJECT?.trim(),
  )
}

function configureWebPush() {
  if (!isWebPushConfigured()) {
    throw new Error("Web Push is not configured (VAPID keys)")
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!.trim(),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  )
}

function topicColumn(topic: PushTopic): "queue_live" | "walmart_wednesday" {
  return topic === "queue_live" ? "queue_live" : "walmart_wednesday"
}

export async function upsertPushSubscription(input: {
  endpoint: string
  p256dh: string
  auth: string
  userId?: string | null
  queueLive?: boolean
  walmartWednesday?: boolean
  userAgent?: string | null
}): Promise<void> {
  const record: PushSubscriptionRecord = {
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    userId: input.userId ?? null,
    queueLive: input.queueLive ?? true,
    walmartWednesday: input.walmartWednesday ?? true,
  }
  memorySubs.set(record.endpoint, record)

  if (!isSupabaseConfigured()) return

  try {
    const supabase = createAdminClient()
    await supabase.from("push_subscriptions").upsert(
      {
        endpoint: record.endpoint,
        p256dh: record.p256dh,
        auth: record.auth,
        user_id: record.userId,
        queue_live: record.queueLive,
        walmart_wednesday: record.walmartWednesday,
        user_agent: input.userAgent ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    )
  } catch {
    // Table may not exist yet; memory fallback still works on warm instances.
  }
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  memorySubs.delete(endpoint)
  if (!isSupabaseConfigured()) return
  try {
    const supabase = createAdminClient()
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint)
  } catch {
    // ignore
  }
}

async function listSubscriptions(topic: PushTopic): Promise<PushSubscriptionRecord[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient()
      const column = topicColumn(topic)
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth, user_id, queue_live, walmart_wednesday")
        .eq(column, true)

      if (!error && data) {
        return data.map((row) => ({
          endpoint: row.endpoint as string,
          p256dh: row.p256dh as string,
          auth: row.auth as string,
          userId: (row.user_id as string | null) ?? null,
          queueLive: Boolean(row.queue_live),
          walmartWednesday: Boolean(row.walmart_wednesday),
        }))
      }
    } catch {
      // fall through
    }
  }

  return [...memorySubs.values()].filter((s) =>
    topic === "queue_live" ? s.queueLive : s.walmartWednesday,
  )
}

/** Queue-live alerts only go to signed-in Pro members. */
async function filterProQueueSubscribers(
  subs: PushSubscriptionRecord[],
): Promise<PushSubscriptionRecord[]> {
  const withUser = subs.filter((s) => Boolean(s.userId))
  if (withUser.length === 0) return []

  const uniqueIds = [...new Set(withUser.map((s) => s.userId!))]
  const flags = await Promise.all(
    uniqueIds.map(async (id) => [id, await requireQueueWatchAccess(id)] as const),
  )
  const proIds = new Set(flags.filter(([, ok]) => ok).map(([id]) => id))
  return withUser.filter((s) => s.userId && proIds.has(s.userId))
}

/** Returns true if this alert_key was not sent recently (and records it). */
export async function claimPushAlertDedupe(
  alertKey: string,
  ttlMs: number,
): Promise<boolean> {
  const now = Date.now()
  const lastMem = memoryDedupe.get(alertKey) ?? 0
  if (now - lastMem < ttlMs) return false

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from("push_alert_dedupe")
        .select("alert_key, sent_at")
        .eq("alert_key", alertKey)
        .maybeSingle()

      if (data?.sent_at) {
        const sentAt = new Date(data.sent_at as string).getTime()
        if (now - sentAt < ttlMs) {
          memoryDedupe.set(alertKey, sentAt)
          return false
        }
      }

      await supabase.from("push_alert_dedupe").upsert({
        alert_key: alertKey,
        sent_at: new Date(now).toISOString(),
      })
    } catch {
      // memory-only dedupe
    }
  }

  memoryDedupe.set(alertKey, now)
  return true
}

export async function sendWebPushToTopic(
  topic: PushTopic,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; skipped: boolean; reason?: string }> {
  if (!isWebPushConfigured()) {
    return { sent: 0, failed: 0, skipped: true, reason: "not_configured" }
  }

  configureWebPush()
  let subs = await listSubscriptions(topic)
  if (topic === "queue_live") {
    subs = await filterProQueueSubscribers(subs)
  }
  if (subs.length === 0) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: topic === "queue_live" ? "no_pro_subscribers" : "no_subscribers",
    }
  }

  const body = JSON.stringify(payload)
  let sent = 0
  let failed = 0

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60, urgency: "high" },
        )
        sent += 1
      } catch (err) {
        failed += 1
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode?: number }).statusCode)
            : 0
        if (statusCode === 404 || statusCode === 410) {
          await removePushSubscription(sub.endpoint)
        }
      }
    }),
  )

  return { sent, failed, skipped: false }
}
