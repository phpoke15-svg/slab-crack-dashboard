import "server-only"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  adSyntheticMinutesPerWatch,
  canEarnAdMinuteBonus,
  dailyAdWatchLimit,
  utcTodayIso,
} from "@/lib/giveaway/constants"
import { tryAwardDailyGiveawayEntry } from "@/lib/giveaway/award-entry"

function missingTableMessage(error: { message?: string } | null): string | null {
  const message = error?.message ?? ""
  if (/relation .* does not exist|could not find the table/i.test(message)) {
    return "Ad reward tables are not set up yet. Run supabase/giveaway-daily-ads.sql in Supabase."
  }
  return null
}

export async function getAdsWatchedToday(userId: string, date = utcTodayIso()): Promise<number> {
  if (!isSupabaseConfigured()) return 0

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("user_daily_ads")
    .select("ads_watched")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle()

  if (error) {
    const missing = missingTableMessage(error)
    if (missing) return 0
    throw new Error(error.message)
  }

  return data?.ads_watched ?? 0
}

async function hasProcessedTransaction(transactionId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("ad_reward_transactions")
    .select("transaction_id")
    .eq("transaction_id", transactionId)
    .maybeSingle()

  if (error) {
    const missing = missingTableMessage(error)
    if (missing) return false
    throw new Error(error.message)
  }

  return Boolean(data)
}

async function recordTransaction(userId: string, transactionId: string, date: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from("ad_reward_transactions").insert({
    transaction_id: transactionId,
    user_id: userId,
    reward_date: date,
  })

  if (error && !/duplicate key|unique constraint/i.test(error.message)) {
    throw new Error(missingTableMessage(error) ?? error.message)
  }
}

export type RecordCompletedAdResult = {
  ok: boolean
  reason?: string
  adsWatched?: number
  adsDailyLimit?: number
  activeMinutes?: number
  qualifyingMinutes?: number
  thresholdMinutes?: number
  entryAwarded?: boolean
  awarded?: boolean
  entriesAdded?: number
  monthEntries?: number
  monthEntriesRemaining?: number
}

export async function recordCompletedAd(
  userId: string,
  opts: { transactionId?: string | null; plan: string } = { plan: "free" },
): Promise<RecordCompletedAdResult> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")

  const adLimit = dailyAdWatchLimit(opts.plan)
  if (!canEarnAdMinuteBonus(opts.plan)) {
    return { ok: false, reason: "ads_not_available_for_plan" }
  }

  const today = utcTodayIso()
  const admin = createAdminClient()

  if (opts.transactionId) {
    const seen = await hasProcessedTransaction(opts.transactionId)
    if (seen) {
      return { ok: false, reason: "transaction_already_processed" }
    }
  }

  const { data: adsRow, error: adsReadErr } = await admin
    .from("user_daily_ads")
    .select("ads_watched")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle()

  if (adsReadErr) throw new Error(missingTableMessage(adsReadErr) ?? adsReadErr.message)

  const currentAds = adsRow?.ads_watched ?? 0
  if (currentAds >= adLimit) {
    return {
      ok: false,
      reason: "daily_ad_limit_reached",
      adsWatched: currentAds,
      adsDailyLimit: adLimit,
    }
  }

  const newAdsWatched = currentAds + 1
  const { error: adsUpsertErr } = await admin.from("user_daily_ads").upsert(
    {
      user_id: userId,
      date: today,
      ads_watched: newAdsWatched,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" },
  )

  if (adsUpsertErr) throw new Error(missingTableMessage(adsUpsertErr) ?? adsUpsertErr.message)

  if (opts.transactionId) {
    await recordTransaction(userId, opts.transactionId, today)
  }

  const award = await tryAwardDailyGiveawayEntry(userId)

  return {
    ok: true,
    adsWatched: newAdsWatched,
    adsDailyLimit: adLimit,
    adMinutesPerWatch: adSyntheticMinutesPerWatch(opts.plan),
    activeMinutes: award.activeMinutes,
    qualifyingMinutes: award.qualifyingMinutes,
    thresholdMinutes: award.thresholdMinutes,
    entryAwarded: award.entryAwarded,
    awarded: award.awarded,
    entriesAdded: award.entriesAdded,
    monthEntries: award.monthEntries,
    monthEntriesRemaining: award.monthEntriesRemaining,
    reason: award.reason,
  }
}
