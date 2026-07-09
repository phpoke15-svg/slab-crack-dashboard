import type { SupabaseClient } from "@supabase/supabase-js"
import type { Trade, TradeItem, TradeStatus } from "@/lib/trade-binder/users"

type TradeRow = {
  id: string
  initiator_id: string
  recipient_id: string
  status: TradeStatus
  message: string
  created_at: string
  updated_at: string
  completed_at: string | null
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
    const actorIsInitiator = actorId === existing.initiatorId
    const initiatorItems = actorIsInitiator ? myItems : theirItems
    const recipientItems = actorIsInitiator ? theirItems : myItems

    const { error: updateError } = await supabase
      .from("trades")
      .update({
        status: "pending",
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

export async function updateTradeStatus(
  supabase: SupabaseClient,
  tradeId: string,
  userId: string,
  status: TradeStatus,
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === "completed") patch.completed_at = new Date().toISOString()

  const { error } = await supabase
    .from("trades")
    .update(patch)
    .eq("id", tradeId)
    .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)

  return { error: error?.message ?? null }
}
