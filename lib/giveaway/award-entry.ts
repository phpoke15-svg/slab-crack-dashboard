import "server-only"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  activeMinutesRequired,
  DAILY_APP_ENTRY_CAP,
  MONTHLY_ENTRY_CAP,
  monthPeriod,
  qualifyingActiveMinutes,
  utcTodayIso,
  type EntrySource,
} from "@/lib/giveaway/constants"
import { getAdsWatchedToday } from "@/lib/giveaway/ad-rewards"

function missingTableMessage(error: { message?: string } | null): string | null {
  const message = error?.message ?? ""
  if (/relation .* does not exist|could not find the table/i.test(message)) {
    return "Giveaway tables are not set up yet. Run supabase/giveaway.sql in Supabase."
  }
  return null
}

async function getUserPlan(userId: string): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin.from("profiles").select("plan").eq("id", userId).maybeSingle()
  return (data?.plan as string | undefined) ?? "free"
}

async function countMonthEntries(userId: string, period: string): Promise<number> {
  const admin = createAdminClient()
  const { count, error } = await admin
    .from("giveaway_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("month_period", period)

  if (error) throw new Error(missingTableMessage(error) ?? error.message)
  return count ?? 0
}

async function insertEntries(
  userId: string,
  period: string,
  earnedOn: string,
  source: EntrySource,
  count: number,
): Promise<number> {
  if (count <= 0) return 0

  const existing = await countMonthEntries(userId, period)
  const toInsert = Math.min(count, Math.max(0, MONTHLY_ENTRY_CAP - existing))
  if (toInsert <= 0) return 0

  const admin = createAdminClient()
  const rows = Array.from({ length: toInsert }, () => ({
    user_id: userId,
    month_period: period,
    earned_on: earnedOn,
    source,
  }))

  const { error } = await admin.from("giveaway_entries").insert(rows)
  if (error) throw new Error(missingTableMessage(error) ?? error.message)
  return toInsert
}

export type AwardDailyEntryResult = {
  awarded: boolean
  reason?: string
  entriesAdded?: number
  activeMinutes: number
  qualifyingMinutes: number
  thresholdMinutes: number
  entryAwarded: boolean
  monthEntries?: number
  monthEntriesRemaining?: number
  minutesRemaining?: number
}

/** Shared entry award check using actual + synthetic (ad) minutes. */
export async function tryAwardDailyGiveawayEntry(userId: string): Promise<AwardDailyEntryResult> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")

  const today = utcTodayIso()
  const period = monthPeriod()
  const plan = await getUserPlan(userId)
  const threshold = activeMinutesRequired(plan)

  const monthEntries = await countMonthEntries(userId, period)
  if (monthEntries >= MONTHLY_ENTRY_CAP) {
    return {
      awarded: false,
      reason: "monthly_cap_reached",
      activeMinutes: 0,
      qualifyingMinutes: 0,
      thresholdMinutes: threshold,
      entryAwarded: false,
      monthEntries: MONTHLY_ENTRY_CAP,
    }
  }

  const admin = createAdminClient()
  const [activity, adsWatched] = await Promise.all([
    admin
      .from("giveaway_daily_app_activity")
      .select("active_minutes, entry_awarded")
      .eq("user_id", userId)
      .eq("activity_date", today)
      .maybeSingle(),
    getAdsWatchedToday(userId, today),
  ])

  if (activity.error) {
    throw new Error(missingTableMessage(activity.error) ?? activity.error.message)
  }

  const activeMinutes = activity.data?.active_minutes ?? 0
  const entryAwarded = Boolean(activity.data?.entry_awarded)
  const qualifyingMinutes = qualifyingActiveMinutes(activeMinutes, adsWatched, plan)

  if (entryAwarded) {
    return {
      awarded: false,
      reason: "daily_entry_already_awarded",
      activeMinutes,
      qualifyingMinutes,
      thresholdMinutes: threshold,
      entryAwarded: true,
    }
  }

  if (qualifyingMinutes < threshold) {
    return {
      awarded: false,
      reason: "below_threshold",
      activeMinutes,
      qualifyingMinutes,
      thresholdMinutes: threshold,
      entryAwarded: false,
      minutesRemaining: threshold - qualifyingMinutes,
    }
  }

  const inserted = await insertEntries(userId, period, today, "app_usage", DAILY_APP_ENTRY_CAP)
  if (inserted === 0) {
    return {
      awarded: false,
      reason: "monthly_cap_reached",
      activeMinutes,
      qualifyingMinutes,
      thresholdMinutes: threshold,
      entryAwarded: false,
    }
  }

  const { error: markErr } = await admin
    .from("giveaway_daily_app_activity")
    .upsert(
      {
        user_id: userId,
        activity_date: today,
        active_minutes: activeMinutes,
        entry_awarded: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,activity_date" },
    )

  if (markErr) throw new Error(missingTableMessage(markErr) ?? markErr.message)

  const total = await countMonthEntries(userId, period)
  return {
    awarded: true,
    entriesAdded: inserted,
    activeMinutes,
    qualifyingMinutes,
    thresholdMinutes: threshold,
    entryAwarded: true,
    monthEntries: total,
    monthEntriesRemaining: Math.max(0, MONTHLY_ENTRY_CAP - total),
  }
}
