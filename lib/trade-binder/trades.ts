import type { SupabaseClient } from "@supabase/supabase-js"
import { FULFILLMENT_CLEAR_PATCH, mapFulfillmentFromRow } from "@/lib/trade-binder/trade-fulfillment"
import {
  CANCEL_CLEAR_PATCH,
  mapCancellationFromRow,
  partnerHasRequestedCancel,
  userHasRequestedCancel,
} from "@/lib/trade-binder/trade-cancellation"
import { SHIPPING_CLEAR_PATCH, mapShippingFromRow } from "@/lib/trade-binder/trade-shipping"
import { createCrossUserReader } from "@/lib/trade-binder/cross-user-client"
import {
  finalizeCardsForCompletedTrade,
  lockCardsForAcceptedTrade,
  unlockCardsForCancelledTrade,
} from "@/lib/trade-binder/trade-binder-lock"
import type { Trade, TradeItem, TradeStatus, TradeFulfillmentItem } from "@/lib/trade-binder/users"

export const TRADE_PROPOSAL_RESET_PATCH = {
  status: "pending" as const,
  initiator_accepted_at: null,
  recipient_accepted_at: null,
  ...FULFILLMENT_CLEAR_PATCH,
  ...SHIPPING_CLEAR_PATCH,
  ...CANCEL_CLEAR_PATCH,
}

type TradeRow = {
  id: string
  initiator_id: string
  recipient_id: string
  status: TradeStatus
  message: string
  created_at: string
  updated_at: string
  completed_at: string | null
  initiator_accepted_at: string | null
  recipient_accepted_at: string | null
  fulfillment_addresses_at?: string | null
  fulfillment_tracking_at?: string | null
  fulfillment_received_at?: string | null
  initiator_cancelled_at?: string | null
  recipient_cancelled_at?: string | null
  initiator_tracking?: string | null
  recipient_tracking?: string | null
  initiator_carrier?: string | null
  recipient_carrier?: string | null
  initiator_shipping_address?: string | null
  recipient_shipping_address?: string | null
}

type TradeItemRow = {
  id: string
  trade_id: string
  user_id: string
  card_id: string
  card_name: string | null
  card_set: string | null
  card_image: string | null
}

function mapTrade(row: TradeRow, items: TradeItemRow[]): Trade {
  return {
    id: row.id,
    initiatorId: row.initiator_id,
    recipientId: row.recipient_id,
    status: row.status,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    completedAt: row.completed_at,
    initiatorAcceptedAt: row.initiator_accepted_at ?? null,
    recipientAcceptedAt: row.recipient_accepted_at ?? null,
    fulfillment: mapFulfillmentFromRow(row),
    shipping: mapShippingFromRow(row),
    cancellation: mapCancellationFromRow(row),
    items: items.map(
      (item): TradeItem => ({
        id: item.id,
        userId: item.user_id,
        cardId: item.card_id,
        cardName: item.card_name ?? "",
        cardSet: item.card_set ?? "",
        cardImage: item.card_image ?? "",
      }),
    ),
  }
}

export async function listTradesForUser(supabase: SupabaseClient, userId: string): Promise<Trade[]> {
  const { data: tradeRows, error } = await supabase
    .from("trades")
    .select("*")
    .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false })

  if (error || !tradeRows?.length) return []

  const tradeIds = tradeRows.map((t) => t.id)
  const { data: itemRows } = await supabase.from("trade_items").select("*").in("trade_id", tradeIds)

  const itemsByTrade = new Map<string, TradeItemRow[]>()
  for (const item of (itemRows ?? []) as TradeItemRow[]) {
    const list = itemsByTrade.get(item.trade_id) ?? []
    list.push(item)
    itemsByTrade.set(item.trade_id, list)
  }

  return (tradeRows as TradeRow[]).map((row) => mapTrade(row, itemsByTrade.get(row.id) ?? []))
}

export function tradePartnerId(trade: Trade, userId: string): string {
  return trade.initiatorId === userId ? trade.recipientId : trade.initiatorId
}

export function userHasAcceptedTrade(trade: Trade, userId: string): boolean {
  if (trade.initiatorId === userId) return Boolean(trade.initiatorAcceptedAt)
  if (trade.recipientId === userId) return Boolean(trade.recipientAcceptedAt)
  return false
}

export function partnerHasAcceptedTrade(trade: Trade, userId: string): boolean {
  if (trade.initiatorId === userId) return Boolean(trade.recipientAcceptedAt)
  if (trade.recipientId === userId) return Boolean(trade.initiatorAcceptedAt)
  return false
}

export function isTradeFullyAccepted(trade: Trade | null | undefined): boolean {
  if (!trade) return false
  return Boolean(trade.initiatorAcceptedAt && trade.recipientAcceptedAt)
}

/** Accepted tab + badges — includes trades both parties confirmed even if status was reset. */
export function isTradeAcceptedForDisplay(trade: Trade | null | undefined): boolean {
  if (!trade) return false
  return trade.status === "accepted" || isTradeFullyAccepted(trade)
}

export function tradeHasActiveOffer(trade: Trade): boolean {
  return trade.items.length > 0
}

export function tradeNeedsMyAcceptance(trade: Trade, userId: string): boolean {
  return (
    trade.status === "pending" &&
    tradeHasActiveOffer(trade) &&
    !userHasAcceptedTrade(trade, userId)
  )
}

function tradeActivityTime(trade: Trade): string {
  return trade.updatedAt || trade.createdAt
}

export function listTradeThreadsForUser(trades: Trade[], userId: string): Trade[] {
  const byPartner = new Map<string, Trade>()
  for (const trade of trades) {
    const partnerId = tradePartnerId(trade, userId)
    const existing = byPartner.get(partnerId)
    if (!existing || tradeActivityTime(trade) > tradeActivityTime(existing)) {
      byPartner.set(partnerId, trade)
    }
  }
  return [...byPartner.values()].sort((a, b) =>
    tradeActivityTime(b).localeCompare(tradeActivityTime(a)),
  )
}

export async function listTradeIdsBetweenUsers(
  supabase: SupabaseClient,
  userId: string,
  otherId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("id")
    .or(
      `and(initiator_id.eq.${userId},recipient_id.eq.${otherId}),and(initiator_id.eq.${otherId},recipient_id.eq.${userId})`,
    )

  if (error || !data) return []
  return data.map((row) => row.id as string)
}

export async function findTradeThreadBetweenUsers(
  supabase: SupabaseClient,
  userId: string,
  otherId: string,
): Promise<Trade | null> {
  const { data: tradeRows, error } = await supabase
    .from("trades")
    .select("*")
    .or(
      `and(initiator_id.eq.${userId},recipient_id.eq.${otherId}),and(initiator_id.eq.${otherId},recipient_id.eq.${userId})`,
    )
    .order("updated_at", { ascending: false })
    .limit(1)

  if (error || !tradeRows?.length) return null

  const tradeRow = tradeRows[0] as TradeRow
  const { data: items } = await supabase.from("trade_items").select("*").eq("trade_id", tradeRow.id)
  return mapTrade(tradeRow, (items ?? []) as TradeItemRow[])
}

export async function hasCompletedTradeWith(
  supabase: SupabaseClient,
  userId: string,
  otherId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("trades")
    .select("id")
    .eq("status", "completed")
    .or(
      `and(initiator_id.eq.${userId},recipient_id.eq.${otherId}),and(initiator_id.eq.${otherId},recipient_id.eq.${userId})`,
    )
    .limit(1)
  return Boolean(data?.length)
}

export async function listCompletedTradePartnerIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("trades")
    .select("initiator_id, recipient_id")
    .eq("status", "completed")
    .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)

  if (!data) return []
  return [...new Set(data.map((t) => (t.initiator_id === userId ? t.recipient_id : t.initiator_id)))]
}

export async function createTrade(
  supabase: SupabaseClient,
  initiatorId: string,
  recipientId: string,
  message: string,
  myItems: { cardId: string; cardName: string; cardSet: string; cardImage: string }[],
  theirItems: { cardId: string; cardName: string; cardSet: string; cardImage: string }[],
): Promise<{ trade: Trade | null; error: string | null }> {
  const { data: tradeRow, error } = await supabase
    .from("trades")
    .insert({
      initiator_id: initiatorId,
      recipient_id: recipientId,
      message: message.trim(),
      status: "pending",
    })
    .select("*")
    .single()

  if (error || !tradeRow) return { trade: null, error: error?.message ?? "Could not create trade" }

  const tradeId = tradeRow.id
  const rows = [
    ...myItems.map((c) => ({
      trade_id: tradeId,
      user_id: initiatorId,
      card_id: c.cardId,
      card_name: c.cardName,
      card_set: c.cardSet,
      card_image: c.cardImage,
    })),
    ...theirItems.map((c) => ({
      trade_id: tradeId,
      user_id: recipientId,
      card_id: c.cardId,
      card_name: c.cardName,
      card_set: c.cardSet,
      card_image: c.cardImage,
    })),
  ]

  if (rows.length > 0) {
    const { error: itemsError } = await supabase.from("trade_items").insert(rows)
    if (itemsError) return { trade: null, error: itemsError.message }
  }

  const { data: items } = await supabase.from("trade_items").select("*").eq("trade_id", tradeId)
  return { trade: mapTrade(tradeRow as TradeRow, (items ?? []) as TradeItemRow[]), error: null }
}

export async function createOrUpdateTradeProposal(
  supabase: SupabaseClient,
  actorId: string,
  recipientId: string,
  message: string,
  myItems: { cardId: string; cardName: string; cardSet: string; cardImage: string }[],
  theirItems: { cardId: string; cardName: string; cardSet: string; cardImage: string }[],
): Promise<{ trade: Trade | null; error: string | null; created: boolean }> {
  const existing = await findTradeThreadBetweenUsers(supabase, actorId, recipientId)

  if (existing) {
    if (isTradeAcceptedForDisplay(existing)) {
      return {
        trade: null,
        error: "This trade is already accepted. Mark it completed or cancel before sending a new offer.",
        created: false,
      }
    }

    const canReopen =
      existing.status === "pending" ||
      existing.status === "cancelled" ||
      existing.status === "declined" ||
      existing.status === "completed"

    if (!canReopen) {
      return {
        trade: null,
        error: "This trade is no longer open for new offers.",
        created: false,
      }
    }

    const actorIsInitiator = actorId === existing.initiatorId
    const initiatorItems = actorIsInitiator ? myItems : theirItems
    const recipientItems = actorIsInitiator ? theirItems : myItems

    const { error: updateError } = await supabase
      .from("trades")
      .update({
        ...TRADE_PROPOSAL_RESET_PATCH,
        message: message.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)

    if (updateError) return { trade: null, error: updateError.message, created: false }

    const { error: replaceError } = await replaceTradeItems(
      supabase,
      existing.id,
      actorId,
      existing.initiatorId,
      existing.recipientId,
      initiatorItems,
      recipientItems,
    )
    if (replaceError) return { trade: null, error: replaceError, created: false }

    const trade = await getTradeById(supabase, existing.id, actorId)
    return { trade, error: null, created: false }
  }

  const { trade, error } = await createTrade(
    supabase,
    actorId,
    recipientId,
    message,
    myItems,
    theirItems,
  )
  return { trade, error, created: true }
}

export async function ensureTradeThread(
  supabase: SupabaseClient,
  actorId: string,
  recipientId: string,
): Promise<{ trade: Trade | null; error: string | null }> {
  const existing = await findTradeThreadBetweenUsers(supabase, actorId, recipientId)
  if (existing) return { trade: existing, error: null }
  return createTrade(supabase, actorId, recipientId, "", [], [])
}

export async function getTradeById(
  supabase: SupabaseClient,
  tradeId: string,
  userId: string,
): Promise<Trade | null> {
  const { data: tradeRow, error } = await supabase
    .from("trades")
    .select("*")
    .eq("id", tradeId)
    .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
    .maybeSingle()

  if (error || !tradeRow) return null

  const { data: items } = await supabase.from("trade_items").select("*").eq("trade_id", tradeId)
  return mapTrade(tradeRow as TradeRow, (items ?? []) as TradeItemRow[])
}

export async function replaceTradeItems(
  supabase: SupabaseClient,
  tradeId: string,
  userId: string,
  initiatorId: string,
  recipientId: string,
  initiatorItems: { cardId: string; cardName: string; cardSet: string; cardImage: string }[],
  recipientItems: { cardId: string; cardName: string; cardSet: string; cardImage: string }[],
): Promise<{ error: string | null }> {
  const { data: trade } = await supabase
    .from("trades")
    .select("status, initiator_id, recipient_id")
    .eq("id", tradeId)
    .maybeSingle()

  if (!trade || trade.status !== "pending") {
    return { error: "Trade is not open for changes" }
  }
  if (trade.initiator_id !== userId && trade.recipient_id !== userId) {
    return { error: "Not a participant" }
  }

  const { error: deleteError } = await supabase.from("trade_items").delete().eq("trade_id", tradeId)
  if (deleteError) return { error: deleteError.message }

  const rows = [
    ...initiatorItems.map((c) => ({
      trade_id: tradeId,
      user_id: initiatorId,
      card_id: c.cardId,
      card_name: c.cardName,
      card_set: c.cardSet,
      card_image: c.cardImage,
    })),
    ...recipientItems.map((c) => ({
      trade_id: tradeId,
      user_id: recipientId,
      card_id: c.cardId,
      card_name: c.cardName,
      card_set: c.cardSet,
      card_image: c.cardImage,
    })),
  ]

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("trade_items").insert(rows)
    if (insertError) return { error: insertError.message }
  }

  await supabase
    .from("trades")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", tradeId)

  return { error: null }
}

export async function recordTradeAcceptance(
  supabase: SupabaseClient,
  tradeId: string,
  userId: string,
): Promise<{ trade: Trade | null; bothAccepted: boolean; error: string | null }> {
  const trade = await getTradeById(supabase, tradeId, userId)
  if (!trade) return { trade: null, bothAccepted: false, error: "Trade not found" }
  if (trade.status !== "pending") {
    return { trade: null, bothAccepted: false, error: "Trade is not open for acceptance" }
  }
  if (!tradeHasActiveOffer(trade)) {
    return { trade: null, bothAccepted: false, error: "No active offer to accept" }
  }
  if (userHasAcceptedTrade(trade, userId)) {
    return { trade, bothAccepted: trade.status === "accepted", error: null }
  }

  const isInitiator = trade.initiatorId === userId
  const partnerAccepted = partnerHasAcceptedTrade(trade, userId)
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    updated_at: now,
    ...(isInitiator ? { initiator_accepted_at: now } : { recipient_accepted_at: now }),
  }

  if (partnerAccepted) {
    patch.status = "accepted"
  }

  const { error } = await supabase.from("trades").update(patch).eq("id", tradeId)
  if (error) return { trade: null, bothAccepted: false, error: error.message }

  const updated = await getTradeById(supabase, tradeId, userId)
  const bothAccepted = updated?.status === "accepted" || isTradeFullyAccepted(updated)

  if (bothAccepted && updated) {
    const locker = createCrossUserReader()
    if (locker) {
      try {
        await lockCardsForAcceptedTrade(locker, updated)
      } catch {
        // pending columns may not exist until binder-pending-trade.sql is run
      }
    }
  }

  return {
    trade: updated,
    bothAccepted,
    error: null,
  }
}

export async function recordTradeCancellation(
  supabase: SupabaseClient,
  tradeId: string,
  userId: string,
): Promise<{ trade: Trade | null; bothCancelled: boolean; error: string | null }> {
  const trade = await getTradeById(supabase, tradeId, userId)
  if (!trade) return { trade: null, bothCancelled: false, error: "Trade not found" }
  if (trade.status !== "pending" && trade.status !== "accepted") {
    return { trade: null, bothCancelled: false, error: "Trade cannot be cancelled" }
  }
  if (trade.status === "pending" && !tradeHasActiveOffer(trade)) {
    return { trade: null, bothCancelled: false, error: "No active offer to cancel" }
  }
  if (userHasRequestedCancel(trade, userId)) {
    return { trade, bothCancelled: trade.status === "cancelled", error: null }
  }

  const isInitiator = trade.initiatorId === userId
  const partnerRequested = partnerHasRequestedCancel(trade, userId)
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    updated_at: now,
    ...(isInitiator ? { initiator_cancelled_at: now } : { recipient_cancelled_at: now }),
  }

  if (partnerRequested) {
    patch.status = "cancelled"
    patch.initiator_accepted_at = null
    patch.recipient_accepted_at = null
    patch.initiator_cancelled_at = null
    patch.recipient_cancelled_at = null
    Object.assign(patch, FULFILLMENT_CLEAR_PATCH, SHIPPING_CLEAR_PATCH)
  }

  const { error } = await supabase.from("trades").update(patch).eq("id", tradeId)
  if (error) {
    return { trade: null, bothCancelled: false, error: binderErrorMessage(error, "Could not cancel trade") }
  }

  const updated = await getTradeById(supabase, tradeId, userId)
  const bothCancelled = updated?.status === "cancelled"

  if (bothCancelled) {
    const locker = createCrossUserReader()
    if (locker) {
      try {
        await unlockCardsForCancelledTrade(locker, updated)
      } catch {
        // ignore until migration applied
      }
    }
  }

  return {
    trade: updated,
    bothCancelled,
    error: null,
  }
}

export async function updateTradeStatus(
  supabase: SupabaseClient,
  tradeId: string,
  userId: string,
  status: TradeStatus,
): Promise<{ error: string | null }> {
  if (status === "accepted") {
    const { error } = await recordTradeAcceptance(supabase, tradeId, userId)
    return { error }
  }

  if (status === "cancelled") {
    const { error } = await recordTradeCancellation(supabase, tradeId, userId)
    return { error }
  }

  const trade = await getTradeById(supabase, tradeId, userId)
  if (!trade) return { error: "Trade not found" }

  if (status === "completed" && trade.status !== "accepted") {
    return { error: "Both parties must accept before completing the trade" }
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    initiator_accepted_at: null,
    recipient_accepted_at: null,
    ...CANCEL_CLEAR_PATCH,
    ...(status === "completed" ? {} : FULFILLMENT_CLEAR_PATCH),
    ...(status === "completed" ? {} : SHIPPING_CLEAR_PATCH),
  }
  if (status === "completed") patch.completed_at = new Date().toISOString()

  const { error } = await supabase
    .from("trades")
    .update(patch)
    .eq("id", tradeId)
    .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)

  if (!error && status === "completed") {
    const locker = createCrossUserReader()
    if (locker) {
      try {
        await finalizeCardsForCompletedTrade(locker, tradeId)
      } catch {
        // ignore until migration applied
      }
    }
  }

  return { error: error?.message ?? null }
}

const FULFILLMENT_COLUMN: Record<TradeFulfillmentItem, keyof TradeRow> = {
  addresses_exchanged: "fulfillment_addresses_at",
  tracking_shared: "fulfillment_tracking_at",
  cards_received: "fulfillment_received_at",
}

export async function updateTradeFulfillmentItem(
  supabase: SupabaseClient,
  tradeId: string,
  userId: string,
  item: TradeFulfillmentItem,
  checked: boolean,
): Promise<{ trade: Trade | null; error: string | null }> {
  const trade = await getTradeById(supabase, tradeId, userId)
  if (!trade) return { trade: null, error: "Trade not found" }
  if (trade.status !== "accepted") {
    return { trade: null, error: "Checklist is only available after both parties accept" }
  }

  const column = FULFILLMENT_COLUMN[item]
  const patch: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
    [column]: checked ? new Date().toISOString() : null,
  }

  const { error } = await supabase.from("trades").update(patch).eq("id", tradeId)
  if (error) {
    return { trade: null, error: binderErrorMessage(error, "Could not update checklist") }
  }

  const updated = await getTradeById(supabase, tradeId, userId)
  return { trade: updated, error: null }
}

export async function updateTradeShipping(
  supabase: SupabaseClient,
  tradeId: string,
  userId: string,
  tracking: string,
  carrier: string,
  address: string,
): Promise<{ trade: Trade | null; error: string | null }> {
  const trade = await getTradeById(supabase, tradeId, userId)
  if (!trade) return { trade: null, error: "Trade not found" }
  if (trade.status !== "accepted") {
    return { trade: null, error: "Shipping details are only editable on accepted trades" }
  }

  const isInitiator = trade.initiatorId === userId
  const patch: Record<string, string> = {
    updated_at: new Date().toISOString(),
    ...(isInitiator
      ? {
          initiator_tracking: tracking.trim(),
          initiator_carrier: carrier.trim(),
          initiator_shipping_address: address.trim(),
        }
      : {
          recipient_tracking: tracking.trim(),
          recipient_carrier: carrier.trim(),
          recipient_shipping_address: address.trim(),
        }),
  }

  const { error } = await supabase.from("trades").update(patch).eq("id", tradeId)
  if (error) {
    return { trade: null, error: binderErrorMessage(error, "Could not save shipping details") }
  }

  const updated = await getTradeById(supabase, tradeId, userId)
  return { trade: updated, error: null }
}
