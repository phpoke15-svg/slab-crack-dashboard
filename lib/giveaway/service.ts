import "server-only"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  activeMinutesRequired,
  DAILY_APP_ENTRY_CAP,
  GIVEAWAY_PRIZE_PER_ACCOUNT_USD,
  isLastDayOfMonth,
  isPremiumPlan,
  MAIL_IN_ENTRIES_PER_POSTCARD,
  MAX_MAIL_IN_POSTCARDS_PER_MONTH,
  MONTHLY_ENTRY_CAP,
  monthPeriod,
  type EntrySource,
  utcTodayIso,
} from "@/lib/giveaway/constants"
import {
  computeLivePrizeSnapshot,
  getLatestDailySnapshotForMonth,
  getMonthEndDailySnapshot,
  recordDailyAccountSnapshot,
  type PrizeSnapshot,
} from "@/lib/giveaway/prize-snapshot"

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

export async function countMonthEntries(userId: string, period: string): Promise<number> {
  const admin = createAdminClient()
  const { count, error } = await admin
    .from("giveaway_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("month_period", period)

  if (error) throw new Error(missingTableMessage(error) ?? error.message)
  return count ?? 0
}

async function countMailInPostcards(userId: string, period: string): Promise<number> {
  const admin = createAdminClient()
  const { count, error } = await admin
    .from("giveaway_mail_in_postcards")
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

export type GiveawayStatus = {
  monthPeriod: string
  monthEntries: number
  monthEntriesRemaining: number
  monthlyCap: number
  todayActiveMinutes: number
  todayEntryAwarded: boolean
  thresholdMinutes: number
  isPremium: boolean
  mailInPostcardsUsed: number
  mailInPostcardsMax: number
}

export async function getGiveawayStatus(userId: string): Promise<GiveawayStatus> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")

  const today = utcTodayIso()
  const period = monthPeriod()
  const plan = await getUserPlan(userId)
  const premium = isPremiumPlan(plan)
  const threshold = activeMinutesRequired(premium)

  const admin = createAdminClient()
  const [monthEntries, postcards, activity] = await Promise.all([
    countMonthEntries(userId, period),
    countMailInPostcards(userId, period),
    admin
      .from("giveaway_daily_app_activity")
      .select("active_minutes, entry_awarded")
      .eq("user_id", userId)
      .eq("activity_date", today)
      .maybeSingle(),
  ])

  if (activity.error) {
    const missing = missingTableMessage(activity.error)
    if (missing) throw new Error(missing)
    throw new Error(activity.error.message)
  }

  return {
    monthPeriod: period,
    monthEntries,
    monthEntriesRemaining: Math.max(0, MONTHLY_ENTRY_CAP - monthEntries),
    monthlyCap: MONTHLY_ENTRY_CAP,
    todayActiveMinutes: activity.data?.active_minutes ?? 0,
    todayEntryAwarded: Boolean(activity.data?.entry_awarded),
    thresholdMinutes: threshold,
    isPremium: premium,
    mailInPostcardsUsed: postcards,
    mailInPostcardsMax: MAX_MAIL_IN_POSTCARDS_PER_MONTH,
  }
}

export type RecordActiveTimeResult = {
  awarded: boolean
  reason?: string
  entriesAdded?: number
  activeMinutes?: number
  thresholdMinutes?: number
  minutesRemaining?: number
  monthEntries?: number
  monthEntriesRemaining?: number
}

export async function recordActiveTime(
  userId: string,
  minutesAdded: number,
): Promise<RecordActiveTimeResult> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")
  if (minutesAdded <= 0) throw new Error("minutesAdded must be positive")

  const today = utcTodayIso()
  const period = monthPeriod()
  const plan = await getUserPlan(userId)
  const threshold = activeMinutesRequired(isPremiumPlan(plan))

  const monthEntries = await countMonthEntries(userId, period)
  if (monthEntries >= MONTHLY_ENTRY_CAP) {
    return { awarded: false, reason: "monthly_cap_reached", monthEntries: MONTHLY_ENTRY_CAP }
  }

  const admin = createAdminClient()
  const { data: row, error: readErr } = await admin
    .from("giveaway_daily_app_activity")
    .select("active_minutes, entry_awarded")
    .eq("user_id", userId)
    .eq("activity_date", today)
    .maybeSingle()

  if (readErr) throw new Error(missingTableMessage(readErr) ?? readErr.message)

  if (row?.entry_awarded) {
    return {
      awarded: false,
      reason: "daily_entry_already_awarded",
      activeMinutes: row.active_minutes ?? 0,
      thresholdMinutes: threshold,
    }
  }

  const newMinutes = (row?.active_minutes ?? 0) + minutesAdded

  const { error: upsertErr } = await admin.from("giveaway_daily_app_activity").upsert(
    {
      user_id: userId,
      activity_date: today,
      active_minutes: newMinutes,
      entry_awarded: row?.entry_awarded ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,activity_date" },
  )

  if (upsertErr) throw new Error(missingTableMessage(upsertErr) ?? upsertErr.message)

  if (newMinutes < threshold) {
    return {
      awarded: false,
      reason: "below_threshold",
      activeMinutes: newMinutes,
      thresholdMinutes: threshold,
      minutesRemaining: threshold - newMinutes,
    }
  }

  const inserted = await insertEntries(userId, period, today, "app_usage", DAILY_APP_ENTRY_CAP)
  if (inserted === 0) {
    return {
      awarded: false,
      reason: "monthly_cap_reached",
      activeMinutes: newMinutes,
      thresholdMinutes: threshold,
    }
  }

  const { error: markErr } = await admin
    .from("giveaway_daily_app_activity")
    .update({ entry_awarded: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("activity_date", today)

  if (markErr) throw new Error(missingTableMessage(markErr) ?? markErr.message)

  const total = await countMonthEntries(userId, period)
  return {
    awarded: true,
    entriesAdded: inserted,
    activeMinutes: newMinutes,
    thresholdMinutes: threshold,
    monthEntries: total,
    monthEntriesRemaining: Math.max(0, MONTHLY_ENTRY_CAP - total),
  }
}

export type MailInResult = {
  awarded: boolean
  reason?: string
  entriesAdded?: number
  entriesRequested?: number
  entriesCappedTo?: number
  postcardsUsed?: number
  monthEntries?: number
  monthEntriesRemaining?: number
}

export async function addMailInEntries(
  userId: string,
  opts: { quantity?: number; adminId?: string; notes?: string } = {},
): Promise<MailInResult> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")

  const quantity = opts.quantity ?? MAIL_IN_ENTRIES_PER_POSTCARD
  if (quantity <= 0) throw new Error("quantity must be positive")

  const today = utcTodayIso()
  const period = monthPeriod()
  const postcardsUsed = await countMailInPostcards(userId, period)

  if (postcardsUsed >= MAX_MAIL_IN_POSTCARDS_PER_MONTH) {
    return {
      awarded: false,
      reason: "max_postcards_for_month",
      postcardsUsed,
    }
  }

  const monthEntries = await countMonthEntries(userId, period)
  const remaining = Math.max(0, MONTHLY_ENTRY_CAP - monthEntries)
  if (remaining <= 0) {
    return { awarded: false, reason: "monthly_cap_reached", monthEntries: MONTHLY_ENTRY_CAP }
  }

  const toAward = Math.min(quantity, remaining)
  const inserted = await insertEntries(userId, period, today, "mail_in", toAward)

  const admin = createAdminClient()
  const { error } = await admin.from("giveaway_mail_in_postcards").insert({
    user_id: userId,
    month_period: period,
    entries_awarded: inserted,
    processed_by: opts.adminId ?? null,
    notes: opts.notes?.trim() || "",
  })

  if (error) throw new Error(missingTableMessage(error) ?? error.message)

  const total = await countMonthEntries(userId, period)
  return {
    awarded: inserted > 0,
    entriesAdded: inserted,
    entriesRequested: quantity,
    entriesCappedTo: toAward,
    postcardsUsed: postcardsUsed + 1,
    monthEntries: total,
    monthEntriesRemaining: Math.max(0, MONTHLY_ENTRY_CAP - total),
  }
}

export type DrawResult = {
  winnerUserId: string | null
  monthPeriod: string
  totalEntries: number
  uniqueEntrants: number
  winnerEntryCount: number
  accountSnapshot: number
  prizeArvUsd: number
  prizePerAccountUsd: number
}

export type GiveawayDrawLog = {
  monthPeriod: string
  winnerUserId: string | null
  winnerHandle: string | null
  totalEntries: number
  uniqueEntrants: number
  accountSnapshot: number | null
  prizeArvUsd: number | null
  drawnAt: string
}

async function persistPrizeSnapshot(admin: ReturnType<typeof createAdminClient>, snap: PrizeSnapshot) {
  const { error } = await admin.from("giveaway_prize_snapshots").upsert(
    {
      month_period: snap.monthPeriod,
      snapshot_at: snap.snapshotAt,
      account_snapshot: snap.accountSnapshot,
      prize_arv_usd: snap.prizeArvUsd,
      prize_per_account_usd: snap.prizePerAccountUsd,
    },
    { onConflict: "month_period" },
  )
  if (error && !/does not exist|could not find/i.test(error.message)) {
    console.warn("[giveaway-prize-snapshot]", error.message)
  }
}

/** Prize ARV for a promotion month (daily running total for current month; month-end snapshot when final). */
export async function getPrizeSnapshotForMonth(month: string): Promise<PrizeSnapshot> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")

  const admin = createAdminClient()
  const currentMonth = monthPeriod()

  const { data: drawRow } = await admin
    .from("giveaway_draws")
    .select("account_snapshot, prize_arv_usd, prize_per_account_usd, drawn_at")
    .eq("month_period", month)
    .maybeSingle()

  if (drawRow?.account_snapshot != null && drawRow.prize_arv_usd != null) {
    return {
      monthPeriod: month,
      snapshotAt: (drawRow.drawn_at as string) ?? new Date().toISOString(),
      accountSnapshot: Number(drawRow.account_snapshot),
      prizePerAccountUsd: Number(drawRow.prize_per_account_usd ?? GIVEAWAY_PRIZE_PER_ACCOUNT_USD),
      prizeArvUsd: Number(drawRow.prize_arv_usd),
      isMonthEndFinal: true,
    }
  }

  if (month !== currentMonth) {
    const monthEnd = await getMonthEndDailySnapshot(admin, month)
    if (monthEnd) return monthEnd
  }

  if (month === currentMonth) {
    const latest = await getLatestDailySnapshotForMonth(admin, month)
    if (latest) return latest
  }

  const snap = await computeLivePrizeSnapshot(admin, month)
  await persistPrizeSnapshot(admin, snap)
  return snap
}

/** Capture today's running account total (daily cron). Locks month-end value into prize_snapshots. */
export async function captureDailyAccountSnapshot(asOf = new Date()): Promise<PrizeSnapshot> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")

  const admin = createAdminClient()
  const snap = await recordDailyAccountSnapshot(admin, asOf)
  if (isLastDayOfMonth(asOf)) {
    await persistPrizeSnapshot(admin, snap)
  }
  return snap
}

export async function listRecentGiveawayDraws(limit = 6): Promise<GiveawayDrawLog[]> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("giveaway_draws")
    .select(
      "month_period, winner_user_id, total_entries, unique_entrants, account_snapshot, prize_arv_usd, drawn_at",
    )
    .order("month_period", { ascending: false })
    .limit(limit)

  if (error) {
    if (/does not exist|could not find/i.test(error.message)) return []
    throw new Error(error.message)
  }

  const rows = data ?? []
  const winnerIds = [...new Set(rows.map((r) => r.winner_user_id).filter(Boolean))] as string[]
  const handles = new Map<string, string>()

  if (winnerIds.length) {
    const { data: profiles } = await admin.from("profiles").select("id, handle").in("id", winnerIds)
    for (const profile of profiles ?? []) {
      handles.set(profile.id as string, profile.handle as string)
    }
  }

  return rows.map((row) => ({
    monthPeriod: row.month_period as string,
    winnerUserId: (row.winner_user_id as string | null) ?? null,
    winnerHandle: row.winner_user_id ? (handles.get(row.winner_user_id as string) ?? null) : null,
    totalEntries: row.total_entries as number,
    uniqueEntrants: row.unique_entrants as number,
    accountSnapshot: row.account_snapshot != null ? Number(row.account_snapshot) : null,
    prizeArvUsd: row.prize_arv_usd != null ? Number(row.prize_arv_usd) : null,
    drawnAt: row.drawn_at as string,
  }))
}

export async function drawMonthlyWinner(month: string): Promise<DrawResult> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")

  const admin = createAdminClient()
  const prize = await getPrizeSnapshotForMonth(month)

  const { data, error } = await admin
    .from("giveaway_entries")
    .select("user_id")
    .eq("month_period", month)

  if (error) throw new Error(missingTableMessage(error) ?? error.message)

  const tickets = (data ?? []).map((r) => r.user_id as string)
  const drawnAt = new Date().toISOString()

  if (!tickets.length) {
    const { error: drawLogErr } = await admin.from("giveaway_draws").upsert(
      {
        month_period: month,
        winner_user_id: null,
        total_entries: 0,
        unique_entrants: 0,
        account_snapshot: prize.accountSnapshot,
        prize_arv_usd: prize.prizeArvUsd,
        prize_per_account_usd: prize.prizePerAccountUsd,
        drawn_at: drawnAt,
      },
      { onConflict: "month_period" },
    )
    if (drawLogErr && !/does not exist|could not find/i.test(drawLogErr.message)) {
      console.warn("[giveaway-draw]", drawLogErr.message)
    }

    return {
      winnerUserId: null,
      monthPeriod: month,
      totalEntries: 0,
      uniqueEntrants: 0,
      winnerEntryCount: 0,
      accountSnapshot: prize.accountSnapshot,
      prizeArvUsd: prize.prizeArvUsd,
      prizePerAccountUsd: prize.prizePerAccountUsd,
    }
  }

  const winner = tickets[Math.floor(Math.random() * tickets.length)]!
  const unique = new Set(tickets).size

  const { error: drawLogErr } = await admin.from("giveaway_draws").upsert(
    {
      month_period: month,
      winner_user_id: winner,
      total_entries: tickets.length,
      unique_entrants: unique,
      account_snapshot: prize.accountSnapshot,
      prize_arv_usd: prize.prizeArvUsd,
      prize_per_account_usd: prize.prizePerAccountUsd,
      drawn_at: drawnAt,
    },
    { onConflict: "month_period" },
  )
  if (drawLogErr && !/does not exist|could not find/i.test(drawLogErr.message)) {
    console.warn("[giveaway-draw]", drawLogErr.message)
  }

  return {
    winnerUserId: winner,
    monthPeriod: month,
    totalEntries: tickets.length,
    uniqueEntrants: unique,
    winnerEntryCount: tickets.filter((id) => id === winner).length,
    accountSnapshot: prize.accountSnapshot,
    prizeArvUsd: prize.prizeArvUsd,
    prizePerAccountUsd: prize.prizePerAccountUsd,
  }
}

/** Resolve profile id from handle or uuid string. */
export async function resolveGiveawayUserId(handleOrId: string): Promise<string | null> {
  const trimmed = handleOrId.trim()
  if (!trimmed) return null

  const admin = createAdminClient()
  if (/^[0-9a-f-]{36}$/i.test(trimmed)) {
    const { data } = await admin.from("profiles").select("id").eq("id", trimmed).maybeSingle()
    return data?.id ?? null
  }

  const handle = trimmed.replace(/^@/, "").toLowerCase()
  const { data } = await admin.from("profiles").select("id").ilike("handle", handle).maybeSingle()
  return data?.id ?? null
}
