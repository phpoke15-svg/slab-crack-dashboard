import type { SupabaseClient } from "@supabase/supabase-js"
import { cardsMatchIdentity } from "@/lib/trade-binder/card-id-match"
import type { Trade, TradeItem } from "@/lib/trade-binder/users"

type BinderRow = {
  id: string
  user_id: string
  card_id: string
  status: string
  card_name: string | null
  card_set: string | null
  card_number: string | null
  pending_trade_id: string | null
  pending_restore_status: string | null
}

function tradePartnerId(trade: Trade, userId: string): string {
  return trade.initiatorId === userId ? trade.recipientId : trade.initiatorId
}

function isAcceptedTrade(trade: Trade): boolean {
  return trade.status === "accepted" || Boolean(trade.initiatorAcceptedAt && trade.recipientAcceptedAt)
}

function itemAsCardLike(item: TradeItem) {
  return {
    cardId: item.cardId,
    cardName: item.cardName,
    cardSet: item.cardSet,
  }
}

function rowAsCardLike(row: BinderRow) {
  return {
    cardId: row.card_id,
    cardName: row.card_name,
    cardSet: row.card_set,
    cardNumber: row.card_number,
  }
}

function matchesTarget(row: BinderRow, item: TradeItem): boolean {
  if (row.card_id === item.cardId) return true
  return cardsMatchIdentity(rowAsCardLike(row), itemAsCardLike(item))
}

async function fetchUserBinderRows(
  supabase: SupabaseClient,
  userId: string,
): Promise<BinderRow[]> {
  const { data, error } = await supabase
    .from("user_binders")
    .select(
      "id, user_id, card_id, status, card_name, card_set, card_number, pending_trade_id, pending_restore_status",
    )
    .eq("user_id", userId)

  if (error || !data) return []
  return data as BinderRow[]
}

async function restoreBinderRow(
  supabase: SupabaseClient,
  rowId: string,
  status: "trade" | "wishlist",
): Promise<void> {
  const { error } = await supabase
    .from("user_binders")
    .update({
      status,
      pending_trade_id: null,
      pending_restore_status: null,
    })
    .eq("id", rowId)

  if (error) throw new Error(error.message)
}

async function markRowsPending(
  supabase: SupabaseClient,
  rows: BinderRow[],
  tradeId: string,
  restoreStatus: "trade" | "wishlist",
): Promise<void> {
  const toLock = rows.filter(
    (row) => row.status !== "pending" || row.pending_trade_id !== tradeId,
  )
  if (toLock.length === 0) return

  const ids = toLock.map((row) => row.id)
  const { error } = await supabase
    .from("user_binders")
    .update({
      status: "pending",
      pending_trade_id: tradeId,
      pending_restore_status: restoreStatus,
    })
    .in("id", ids)

  if (error) throw new Error(error.message)
}

/** Move trade/wishlist cards into pending when both parties accept. */
export async function lockCardsForAcceptedTrade(
  supabase: SupabaseClient,
  trade: Trade,
): Promise<void> {
  if (!isAcceptedTrade(trade)) return

  const initiatorRows = await fetchUserBinderRows(supabase, trade.initiatorId)
  const recipientRows = await fetchUserBinderRows(supabase, trade.recipientId)

  for (const item of trade.items) {
    const pool = item.userId === trade.initiatorId ? initiatorRows : recipientRows
    const matches = pool.filter(
      (row) => row.status === "trade" && matchesTarget(row, item),
    )
    await markRowsPending(supabase, matches, trade.id, "trade")
  }

  for (const userId of [trade.initiatorId, trade.recipientId]) {
    const partnerId = tradePartnerId(trade, userId)
    const pool = userId === trade.initiatorId ? initiatorRows : recipientRows
    const receiving = trade.items.filter((item) => item.userId === partnerId)

    for (const item of receiving) {
      const matches = pool.filter(
        (row) => row.status === "wishlist" && matchesTarget(row, item),
      )
      await markRowsPending(supabase, matches, trade.id, "wishlist")
    }
  }
}

async function restoreCardsFromTradeItems(
  supabase: SupabaseClient,
  trade: Trade,
): Promise<void> {
  const initiatorRows = await fetchUserBinderRows(supabase, trade.initiatorId)
  const recipientRows = await fetchUserBinderRows(supabase, trade.recipientId)

  for (const item of trade.items) {
    const pool = item.userId === trade.initiatorId ? initiatorRows : recipientRows
    const matches = pool.filter(
      (row) =>
        (row.status === "pending" || row.status === "trade") && matchesTarget(row, item),
    )
    for (const row of matches) {
      await restoreBinderRow(supabase, row.id, "trade")
    }
  }

  for (const userId of [trade.initiatorId, trade.recipientId]) {
    const partnerId = tradePartnerId(trade, userId)
    const pool = userId === trade.initiatorId ? initiatorRows : recipientRows
    const receiving = trade.items.filter((item) => item.userId === partnerId)

    for (const item of receiving) {
      const matches = pool.filter(
        (row) =>
          (row.status === "pending" || row.status === "wishlist") && matchesTarget(row, item),
      )
      for (const row of matches) {
        await restoreBinderRow(supabase, row.id, "wishlist")
      }
    }
  }
}

/** Restore cards to I have / I want after both parties cancel an accepted trade. */
export async function unlockCardsForCancelledTrade(
  supabase: SupabaseClient,
  trade: Trade,
): Promise<void> {
  const { data, error } = await supabase
    .from("user_binders")
    .select("id, pending_restore_status")
    .eq("pending_trade_id", trade.id)

  if (!error && data?.length) {
    for (const row of data as { id: string; pending_restore_status: "trade" | "wishlist" | null }[]) {
      await restoreBinderRow(supabase, row.id, row.pending_restore_status ?? "trade")
    }
    return
  }

  await restoreCardsFromTradeItems(supabase, trade)
}

/** Remove locked cards after a trade is completed (sent / received). */
export async function finalizeCardsForCompletedTrade(
  supabase: SupabaseClient,
  tradeId: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_binders")
    .delete()
    .eq("pending_trade_id", tradeId)

  if (error) throw new Error(error.message)
}

export async function syncLocksForAcceptedTrades(
  supabase: SupabaseClient,
  trades: Trade[],
): Promise<void> {
  for (const trade of trades) {
    if (!isAcceptedTrade(trade)) continue
    if (trade.status === "cancelled") continue
    try {
      await lockCardsForAcceptedTrade(supabase, trade)
    } catch {
      // Missing columns until binder-pending-trade.sql is applied.
    }
  }
}
