import webpush from "web-push"
import { getEntitlementsForUser, requireQueueWatchAccess } from "@/lib/billing/stripe"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"

export type PushTopic = "queue_live" | "walmart_wednesday"

export type PushUserTopic = "social" | "price"

export type PushSubscriptionRecord = {
  endpoint: string
  p256dh: string
  auth: string
  userId?: string | null
  queueLive: boolean
  walmartWednesday: boolean
  socialAlerts: boolean
  priceAlerts: boolean
  giveawayReminders: boolean
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

function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? "").toLowerCase()
  return error.code === "42703" || msg.includes("does not exist") || msg.includes("column")
}

function rowToRecord(row: Record<string, unknown>): PushSubscriptionRecord {
  return {
    endpoint: row.endpoint as string,
    p256dh: row.p256dh as string,
    auth: row.auth as string,
    userId: (row.user_id as string | null) ?? null,
    queueLive: Boolean(row.queue_live),
    walmartWednesday: Boolean(row.walmart_wednesday),
    socialAlerts: row.social_alerts !== false,
    priceAlerts: row.price_alerts !== false,
    giveawayReminders: Boolean(row.giveaway_reminders),
  }
}

const PUSH_SUBSCRIPTION_SELECT_FULL =
  "endpoint, p256dh, auth, user_id, queue_live, walmart_wednesday, social_alerts, price_alerts, giveaway_reminders"

const PUSH_SUBSCRIPTION_SELECT_BASE =
  "endpoint, p256dh, auth, user_id, queue_live, walmart_wednesday"

export async function upsertPushSubscription(input: {
  endpoint: string
  p256dh: string
  auth: string
  userId?: string | null
  queueLive?: boolean
  walmartWednesday?: boolean
  socialAlerts?: boolean
  priceAlerts?: boolean
  giveawayReminders?: boolean
  userAgent?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const record: PushSubscriptionRecord = {
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    userId: input.userId ?? null,
    queueLive: input.queueLive ?? true,
    walmartWednesday: input.walmartWednesday ?? true,
    socialAlerts: input.socialAlerts ?? true,
    priceAlerts: input.priceAlerts ?? true,
    giveawayReminders: input.giveawayReminders ?? false,
  }
  memorySubs.set(record.endpoint, record)

  if (!isSupabaseConfigured()) return { ok: true }

  const supabase = createAdminClient()
  const updatedAt = new Date().toISOString()
  const fullRow = {
    endpoint: record.endpoint,
    p256dh: record.p256dh,
    auth: record.auth,
    user_id: record.userId,
    queue_live: record.queueLive,
    walmart_wednesday: record.walmartWednesday,
    social_alerts: record.socialAlerts,
    price_alerts: record.priceAlerts,
    giveaway_reminders: record.giveawayReminders,
    user_agent: input.userAgent ?? null,
    updated_at: updatedAt,
  }
  const baseRow = {
    endpoint: record.endpoint,
    p256dh: record.p256dh,
    auth: record.auth,
    user_id: record.userId,
    queue_live: record.queueLive,
    walmart_wednesday: record.walmartWednesday,
    user_agent: input.userAgent ?? null,
    updated_at: updatedAt,
  }

  try {
    let { error } = await supabase
      .from("push_subscriptions")
      .upsert(fullRow, { onConflict: "endpoint" })

    if (error && isMissingColumnError(error)) {
      ;({ error } = await supabase
        .from("push_subscriptions")
        .upsert(baseRow, { onConflict: "endpoint" }))
    }

    if (error) {
      console.error("[push] upsert failed:", error.message)
      return { ok: false, error: error.message }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "push_subscriptions upsert failed"
    console.error("[push] upsert threw:", message)
    return { ok: false, error: message }
  }

  return { ok: true }
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

async function queryPushSubscriptions(
  filters?: { column: string; value: boolean | string }[],
): Promise<PushSubscriptionRecord[] | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = createAdminClient()
  const run = async (select: string) => {
    let query = supabase.from("push_subscriptions").select(select)
    for (const filter of filters ?? []) {
      query = query.eq(filter.column, filter.value)
    }
    return query
  }

  try {
    let { data, error } = await run(PUSH_SUBSCRIPTION_SELECT_FULL)
    if (error && isMissingColumnError(error)) {
      ;({ data, error } = await run(PUSH_SUBSCRIPTION_SELECT_BASE))
    }
    if (error) {
      console.error("[push] list failed:", error.message)
      return null
    }
    return (data ?? []).map((row) => rowToRecord(row as Record<string, unknown>))
  } catch (err) {
    console.error("[push] list threw:", err instanceof Error ? err.message : err)
    return null
  }
}

async function listSubscriptions(topic: PushTopic): Promise<PushSubscriptionRecord[]> {
  const column = topicColumn(topic)
  const fromDb = await queryPushSubscriptions([{ column, value: true }])
  if (fromDb) return fromDb

  return [...memorySubs.values()].filter((s) =>
    topic === "queue_live" ? s.queueLive : s.walmartWednesday,
  )
}

function userTopicColumn(topic: PushUserTopic): "social_alerts" | "price_alerts" {
  return topic === "social" ? "social_alerts" : "price_alerts"
}

/** Send a push to one signed-in user (social or price alerts). */
export async function sendWebPushToUser(
  userId: string,
  topic: PushUserTopic,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!isWebPushConfigured() || !userId) {
    return { sent: 0, failed: 0 }
  }

  configureWebPush()
  const column = userTopicColumn(topic)
  let subs = (await queryPushSubscriptions([
    { column: "user_id", value: userId },
    { column, value: true },
  ])) ?? []

  if (subs.length === 0) {
    subs = [...memorySubs.values()].filter(
      (s) =>
        s.userId === userId &&
        (topic === "social" ? s.socialAlerts : s.priceAlerts),
    )
  }

  if (subs.length === 0) return { sent: 0, failed: 0 }

  const result = await deliverWebPush(subs, payload)
  return { sent: result.sent, failed: result.failed }
}

/** Send a giveaway entry reminder to one signed-in user. */
export async function sendWebPushGiveawayReminder(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!isWebPushConfigured() || !userId) {
    return { sent: 0, failed: 0 }
  }

  configureWebPush()
  let subs =
    (await queryPushSubscriptions([
      { column: "user_id", value: userId },
      { column: "giveaway_reminders", value: true },
    ])) ?? []

  if (subs.length === 0) {
    subs = [...memorySubs.values()].filter((s) => s.userId === userId && s.giveawayReminders)
  }

  if (subs.length === 0) return { sent: 0, failed: 0 }

  const result = await deliverWebPush(subs, payload)
  return { sent: result.sent, failed: result.failed }
}

/** Queue-live alerts go to Pro + Supreme members who opted in; Supreme always receives every topic. */
async function filterQueueWatchSubscribers(
  subs: PushSubscriptionRecord[],
): Promise<PushSubscriptionRecord[]> {
  const withUser = subs.filter((s) => Boolean(s.userId))
  if (withUser.length === 0) return []

  const uniqueIds = [...new Set(withUser.map((s) => s.userId!))]
  const flags = await Promise.all(
    uniqueIds.map(async (id) => [id, await requireQueueWatchAccess(id)] as const),
  )
  const allowedIds = new Set(flags.filter(([, ok]) => ok).map(([id]) => id))
  return withUser.filter((s) => s.userId && allowedIds.has(s.userId))
}

function mergeSubscriptionsByEndpoint(
  ...groups: PushSubscriptionRecord[][]
): PushSubscriptionRecord[] {
  const byEndpoint = new Map<string, PushSubscriptionRecord>()
  for (const group of groups) {
    for (const sub of group) {
      if (!byEndpoint.has(sub.endpoint)) byEndpoint.set(sub.endpoint, sub)
    }
  }
  return [...byEndpoint.values()]
}

/** Every push subscription tied to a Supreme account (all alert types). */
async function listSupremePushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const all = await listAllSubscriptions()
  const withUser = all.filter((s) => Boolean(s.userId))
  if (withUser.length === 0) return []

  const uniqueIds = [...new Set(withUser.map((s) => s.userId!))]
  const flags = await Promise.all(
    uniqueIds.map(async (id) => [id, (await getEntitlementsForUser(id)).supreme] as const),
  )
  const supremeIds = new Set(flags.filter(([, ok]) => ok).map(([id]) => id))
  return withUser.filter((s) => s.userId && supremeIds.has(s.userId))
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
    } catch {
      // fall through to memory claim
    }
  }

  memoryDedupe.set(alertKey, now)
  return true
}

/** Undo a dedupe claim when delivery failed (so the next edge can retry). */
export async function releasePushAlertDedupe(alertKey: string): Promise<void> {
  memoryDedupe.delete(alertKey)
  if (!isSupabaseConfigured()) return
  try {
    const supabase = createAdminClient()
    await supabase.from("push_alert_dedupe").delete().eq("alert_key", alertKey)
  } catch {
    // ignore
  }
}

/** True when a global alert was recorded inside the TTL window. */
export async function wasGlobalPushSentRecently(
  alertKey: string,
  ttlMs: number,
): Promise<boolean> {
  const now = Date.now()
  const lastMem = memoryDedupe.get(alertKey)
  if (lastMem && now - lastMem < ttlMs) return true

  if (!isSupabaseConfigured()) return false

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("push_alert_dedupe")
      .select("sent_at")
      .eq("alert_key", alertKey)
      .maybeSingle()
    if (!data?.sent_at) return false
    const sentAt = new Date(data.sent_at as string).getTime()
    if (now - sentAt < ttlMs) {
      memoryDedupe.set(alertKey, sentAt)
      return true
    }
  } catch {
    // ignore
  }
  return false
}

/** Record successful global push (call after sent > 0). */
export async function recordPushAlertDedupe(alertKey: string): Promise<void> {
  const now = Date.now()
  memoryDedupe.set(alertKey, now)
  if (!isSupabaseConfigured()) return
  try {
    const supabase = createAdminClient()
    await supabase.from("push_alert_dedupe").upsert({
      alert_key: alertKey,
      sent_at: new Date(now).toISOString(),
    })
  } catch {
    // memory-only
  }
}

export async function countRawQueuePushSubscribers(): Promise<number> {
  const subs = await listSubscriptions("queue_live")
  return subs.length
}

export async function countProQueuePushSubscribers(): Promise<number> {
  const subs = await listSubscriptions("queue_live")
  const queueWatch = await filterQueueWatchSubscribers(subs)
  const supreme = await listSupremePushSubscriptions()
  return mergeSubscriptionsByEndpoint(queueWatch, supreme).length
}

/** True when this user has queue_live enabled on at least one stored subscription. */
export async function userHasQueuePushSubscription(userId: string): Promise<boolean> {
  if (!userId || !isSupabaseConfigured()) return false

  const supabase = createAdminClient()
  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("queue_live", true)

  if (error) {
    console.error("[push] userHasQueuePushSubscription failed:", error.message)
    return false
  }
  return (count ?? 0) > 0
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
    subs = await filterQueueWatchSubscribers(subs)
  }
  subs = mergeSubscriptionsByEndpoint(subs, await listSupremePushSubscriptions())
  if (subs.length === 0) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: topic === "queue_live" ? "no_queue_subscribers" : "no_subscribers",
    }
  }

  return deliverWebPush(subs, payload)
}

async function listAllSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const fromDb = await queryPushSubscriptions()
  if (fromDb) return fromDb
  return [...memorySubs.values()]
}

async function deliverWebPush(
  subs: PushSubscriptionRecord[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number; skipped: boolean; reason?: string }> {
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

/**
 * Supreme-only broadcast: notify every stored push subscription
 * (anyone who enabled browser/phone web push on the site).
 */
export async function sendWebPushBroadcast(
  payload: PushPayload,
): Promise<{
  sent: number
  failed: number
  skipped: boolean
  reason?: string
  audience: number
}> {
  if (!isWebPushConfigured()) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "not_configured",
      audience: 0,
    }
  }

  configureWebPush()
  const subs = await listAllSubscriptions()
  if (subs.length === 0) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "no_subscribers",
      audience: 0,
    }
  }

  const result = await deliverWebPush(subs, payload)
  return { ...result, audience: subs.length }
}
