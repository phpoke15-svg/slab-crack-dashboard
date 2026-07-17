import "server-only"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  claimPushAlertDedupe,
  isWebPushConfigured,
  recordPushAlertDedupe,
  releasePushAlertDedupe,
  sendWebPushGiveawayReminder,
} from "@/lib/push/web-push"
import { MONTHLY_ENTRY_CAP, utcTodayIso } from "@/lib/giveaway/constants"
import { getGiveawayStatus } from "@/lib/giveaway/service"

export type GiveawayReminderRunResult = {
  candidates: number
  reminded: number
  skipped: number
  failed: number
}

/** Daily push to opted-in users who have not earned today's app giveaway entry. */
export async function sendGiveawayEntryReminders(): Promise<GiveawayReminderRunResult> {
  if (!isSupabaseConfigured() || !isWebPushConfigured()) {
    return { candidates: 0, reminded: 0, skipped: 0, failed: 0 }
  }

  const admin = createAdminClient()
  const today = utcTodayIso()

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("user_id")
    .eq("giveaway_reminders", true)
    .not("user_id", "is", null)

  if (error) {
    console.warn("[giveaway-reminders] subscription query failed:", error.message)
    return { candidates: 0, reminded: 0, skipped: 0, failed: 0 }
  }

  const userIds = [...new Set((subs ?? []).map((row) => row.user_id as string).filter(Boolean))]
  let reminded = 0
  let skipped = 0
  let failed = 0

  for (const userId of userIds) {
    const dedupeKey = `giveaway-reminder:${userId}:${today}`
    const claimed = await claimPushAlertDedupe(dedupeKey, 24 * 60 * 60 * 1000)
    if (!claimed) {
      skipped += 1
      continue
    }

    try {
      const status = await getGiveawayStatus(userId)
      if (status.todayEntryAwarded || status.monthEntries >= MONTHLY_ENTRY_CAP) {
        await releasePushAlertDedupe(dedupeKey)
        skipped += 1
        continue
      }

      const remaining = Math.max(0, status.thresholdMinutes - status.qualifyingMinutes)
      const body =
        remaining > 0
          ? `You need ${remaining} more qualifying minute${remaining === 1 ? "" : "s"} today to earn your free giveaway entry (active time + rewarded ads).`
          : "You are eligible for today's free giveaway entry — open CollecTools to claim it."

      const result = await sendWebPushGiveawayReminder(userId, {
        title: "Daily giveaway entry reminder",
        body,
        url: "/giveaway",
        tag: dedupeKey,
      })

      if (result.sent > 0) {
        await recordPushAlertDedupe(dedupeKey)
        reminded += 1
      } else {
        await releasePushAlertDedupe(dedupeKey)
        if (result.failed > 0) failed += 1
        else skipped += 1
      }
    } catch (err) {
      await releasePushAlertDedupe(dedupeKey)
      console.warn("[giveaway-reminders] user failed:", userId, err)
      failed += 1
    }
  }

  return { candidates: userIds.length, reminded, skipped, failed }
}

export async function getGiveawayReminderEnabled(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("giveaway_reminders")
    .eq("user_id", userId)
    .eq("giveaway_reminders", true)
    .limit(1)

  if (error) {
    if (/does not exist|could not find/i.test(error.message)) return false
    throw error
  }

  return (data?.length ?? 0) > 0
}

export async function setGiveawayReminderEnabled(userId: string, enabled: boolean): Promise<void> {
  if (!isSupabaseConfigured()) return

  const admin = createAdminClient()
  const { error } = await admin
    .from("push_subscriptions")
    .update({ giveaway_reminders: enabled, updated_at: new Date().toISOString() })
    .eq("user_id", userId)

  if (error && !/does not exist|could not find/i.test(error.message)) {
    throw error
  }
}

export async function userHasPushSubscription(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const admin = createAdminClient()
  const { count, error } = await admin
    .from("push_subscriptions")
    .select("endpoint", { count: "exact", head: true })
    .eq("user_id", userId)

  if (error) {
    if (/does not exist|could not find/i.test(error.message)) return false
    throw error
  }

  return (count ?? 0) > 0
}
