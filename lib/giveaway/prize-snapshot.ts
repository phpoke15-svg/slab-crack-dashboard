import type { SupabaseClient } from "@supabase/supabase-js"
import { GIVEAWAY_PRIZE_PER_ACCOUNT_USD, giveawayPrizeArvUsd } from "@/lib/giveaway/constants"

export type PrizeSnapshot = {
  monthPeriod: string
  snapshotAt: string
  accountSnapshot: number
  prizePerAccountUsd: number
  prizeArvUsd: number
}

export function buildPrizeSnapshot(
  monthPeriod: string,
  accountSnapshot: number,
  snapshotAt = new Date().toISOString(),
): PrizeSnapshot {
  const accounts = Math.max(0, Math.floor(accountSnapshot))
  return {
    monthPeriod,
    snapshotAt,
    accountSnapshot: accounts,
    prizePerAccountUsd: GIVEAWAY_PRIZE_PER_ACCOUNT_USD,
    prizeArvUsd: roundUsd(giveawayPrizeArvUsd(accounts)),
  }
}

function roundUsd(amount: number): number {
  return Math.round(amount * 100) / 100
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
