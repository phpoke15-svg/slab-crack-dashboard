import type { SupabaseClient } from "@supabase/supabase-js"
import { GIVEAWAY_PRIZE_PER_ACCOUNT_USD, giveawayPrizeArvUsd } from "@/lib/giveaway/constants"

export type PrizeSnapshot = {
  monthPeriod: string
  snapshotAt: string
  accountSnapshot: number
  prizePerAccountUsd: number
  prizeArvUsd: number
}

/** 12:00:00 a.m. UTC on the first day of the promotion month (YYYY-MM). */
export function monthSnapshotInstantIso(monthPeriod: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthPeriod)
  if (!match) throw new Error("Invalid month (use YYYY-MM)")
  return `${match[1]}-${match[2]}-01T00:00:00.000Z`
}

export function buildPrizeSnapshot(monthPeriod: string, accountSnapshot: number): PrizeSnapshot {
  const accounts = Math.max(0, Math.floor(accountSnapshot))
  return {
    monthPeriod,
    snapshotAt: monthSnapshotInstantIso(monthPeriod),
    accountSnapshot: accounts,
    prizePerAccountUsd: GIVEAWAY_PRIZE_PER_ACCOUNT_USD,
    prizeArvUsd: roundUsd(giveawayPrizeArvUsd(accounts)),
  }
}

function roundUsd(amount: number): number {
  return Math.round(amount * 100) / 100
}

/** Registered accounts that existed strictly before the snapshot instant. */
export async function countRegisteredAccountsBeforeSnapshot(
  admin: SupabaseClient,
  snapshotAtIso: string,
): Promise<number> {
  const beforeMs = new Date(snapshotAtIso).getTime()
  if (Number.isNaN(beforeMs)) throw new Error("Invalid snapshot timestamp")

  let total = 0
  let page = 1
  while (page <= 50) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (listed.error) throw listed.error

    const users = listed.data.users
    for (const user of users) {
      const createdMs = user.created_at ? new Date(user.created_at).getTime() : 0
      if (createdMs > 0 && createdMs < beforeMs) total += 1
    }

    if (users.length < 1000) break
    page += 1
  }

  return total
}

export async function computePrizeSnapshotForMonth(
  admin: SupabaseClient,
  monthPeriod: string,
): Promise<PrizeSnapshot> {
  const snapshotAt = monthSnapshotInstantIso(monthPeriod)
  const accountSnapshot = await countRegisteredAccountsBeforeSnapshot(admin, snapshotAt)
  return buildPrizeSnapshot(monthPeriod, accountSnapshot)
}
