import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GIVEAWAY_PRIZE_PER_ACCOUNT_USD,
  giveawayPrizeArvUsd,
  lastDayOfMonthIso,
  monthPeriod,
  utcTodayIso,
} from "@/lib/giveaway/constants"

export type PrizeSnapshot = {
  monthPeriod: string
  snapshotAt: string
  /** Calendar date (UTC) of the daily account count, when sourced from daily snapshots. */
  snapshotDate?: string
  accountSnapshot: number
  prizePerAccountUsd: number
  prizeArvUsd: number
  /** True when this snapshot is the official month-end total. */
  isMonthEndFinal?: boolean
}

type DailySnapshotRow = {
  snapshot_date: string
  month_period: string
  account_total: number
  prize_arv_usd: number
  prize_per_account_usd: number
  captured_at: string
}

export function buildPrizeSnapshot(
  monthPeriod: string,
  accountSnapshot: number,
  snapshotAt = new Date().toISOString(),
  opts: { snapshotDate?: string; isMonthEndFinal?: boolean } = {},
): PrizeSnapshot {
  const accounts = Math.max(0, Math.floor(accountSnapshot))
  return {
    monthPeriod,
    snapshotAt,
    snapshotDate: opts.snapshotDate,
    accountSnapshot: accounts,
    prizePerAccountUsd: GIVEAWAY_PRIZE_PER_ACCOUNT_USD,
    prizeArvUsd: roundUsd(giveawayPrizeArvUsd(accounts)),
    isMonthEndFinal: opts.isMonthEndFinal,
  }
}

function roundUsd(amount: number): number {
  return Math.round(amount * 100) / 100
}

function rowToPrizeSnapshot(row: DailySnapshotRow, isMonthEndFinal = false): PrizeSnapshot {
  return {
    monthPeriod: row.month_period,
    snapshotAt: row.captured_at,
    snapshotDate: row.snapshot_date,
    accountSnapshot: Number(row.account_total),
    prizePerAccountUsd: Number(row.prize_per_account_usd ?? GIVEAWAY_PRIZE_PER_ACCOUNT_USD),
    prizeArvUsd: Number(row.prize_arv_usd),
    isMonthEndFinal,
  }
}

/** Total registered auth accounts (matches Site Insights account total). */
export async function countAllRegisteredAccounts(admin: SupabaseClient): Promise<number> {
  let total = 0
  let page = 1
  while (page <= 50) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (listed.error) throw listed.error

    total += listed.data.users.length
    if (listed.data.users.length < 1000) break
    page += 1
  }

  return total
}

export async function computeLivePrizeSnapshot(
  admin: SupabaseClient,
  monthPeriod: string,
): Promise<PrizeSnapshot> {
  const accountSnapshot = await countAllRegisteredAccounts(admin)
  return buildPrizeSnapshot(monthPeriod, accountSnapshot)
}

/** Record today's running account total (idempotent per calendar day). */
export async function recordDailyAccountSnapshot(
  admin: SupabaseClient,
  asOf = new Date(),
): Promise<PrizeSnapshot> {
  const snapshotDate = utcTodayIso(asOf)
  const period = monthPeriod(asOf)
  const accountSnapshot = await countAllRegisteredAccounts(admin)
  const snap = buildPrizeSnapshot(period, accountSnapshot, new Date().toISOString(), {
    snapshotDate,
    isMonthEndFinal: snapshotDate === lastDayOfMonthIso(period),
  })

  const { error } = await admin.from("giveaway_daily_account_snapshots").upsert(
    {
      snapshot_date: snapshotDate,
      month_period: period,
      account_total: snap.accountSnapshot,
      prize_arv_usd: snap.prizeArvUsd,
      prize_per_account_usd: snap.prizePerAccountUsd,
      captured_at: snap.snapshotAt,
    },
    { onConflict: "snapshot_date" },
  )

  if (error) throw error
  return snap
}

/** Latest daily running total for a promotion month. */
export async function getLatestDailySnapshotForMonth(
  admin: SupabaseClient,
  month: string,
): Promise<PrizeSnapshot | null> {
  const { data, error } = await admin
    .from("giveaway_daily_account_snapshots")
    .select(
      "snapshot_date, month_period, account_total, prize_arv_usd, prize_per_account_usd, captured_at",
    )
    .eq("month_period", month)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (/does not exist|could not find/i.test(error.message)) return null
    throw error
  }

  if (!data) return null
  const lastDay = lastDayOfMonthIso(month)
  return rowToPrizeSnapshot(data as DailySnapshotRow, data.snapshot_date === lastDay)
}

/** Official month-end account total — snapshot on the last calendar day of the month. */
export async function getMonthEndDailySnapshot(
  admin: SupabaseClient,
  month: string,
): Promise<PrizeSnapshot | null> {
  const lastDay = lastDayOfMonthIso(month)

  const { data: exact, error: exactErr } = await admin
    .from("giveaway_daily_account_snapshots")
    .select(
      "snapshot_date, month_period, account_total, prize_arv_usd, prize_per_account_usd, captured_at",
    )
    .eq("month_period", month)
    .eq("snapshot_date", lastDay)
    .maybeSingle()

  if (exactErr) {
    if (/does not exist|could not find/i.test(exactErr.message)) return null
    throw exactErr
  }

  if (exact) return rowToPrizeSnapshot(exact as DailySnapshotRow, true)

  const { data: fallback, error: fallbackErr } = await admin
    .from("giveaway_daily_account_snapshots")
    .select(
      "snapshot_date, month_period, account_total, prize_arv_usd, prize_per_account_usd, captured_at",
    )
    .eq("month_period", month)
    .lte("snapshot_date", lastDay)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fallbackErr) {
    if (/does not exist|could not find/i.test(fallbackErr.message)) return null
    throw fallbackErr
  }

  if (!fallback) return null
  return rowToPrizeSnapshot(fallback as DailySnapshotRow, fallback.snapshot_date === lastDay)
}
