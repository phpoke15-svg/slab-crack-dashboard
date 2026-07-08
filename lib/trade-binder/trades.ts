import type { SupabaseClient } from "@supabase/supabase-js"
import type { Trade, TradeItem, TradeStatus } from "@/lib/trade-binder/users"

type TradeRow = {
  id: string
  initiator_id: string
  recipient_id: string
  status: TradeStatus
  message: string
  created_at: string
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
