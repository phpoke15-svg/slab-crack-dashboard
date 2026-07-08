import type { SupabaseClient } from "@supabase/supabase-js"
import type { TradeMessage, TradeMessageType } from "@/lib/trade-binder/users"

type MessageRow = {
  id: string
  trade_id: string
  sender_id: string
  body: string
  message_type: TradeMessageType
  created_at: string
}

function mapMessage(row: MessageRow): TradeMessage {
  return {
    id: row.id,
    tradeId: row.trade_id,
    senderId: row.sender_id,
    body: row.body,
    messageType: row.message_type,
    createdAt: row.created_at,
  }
}

export async function listTradeMessages(
  supabase: SupabaseClient,
  tradeId: string,
): Promise<TradeMessage[]> {
  const { data, error } = await supabase
    .from("trade_messages")
    .select("*")
    .eq("trade_id", tradeId)
    .order("created_at", { ascending: true })

  if (error || !data) return []
  return (data as MessageRow[]).map(mapMessage)
}

export async function listLatestMessagesForTrades(
  supabase: SupabaseClient,
  tradeIds: string[],
): Promise<Record<string, TradeMessage>> {
  if (tradeIds.length === 0) return {}

  const { data, error } = await supabase
    .from("trade_messages")
    .select("*")
    .in("trade_id", tradeIds)
    .order("created_at", { ascending: false })

  if (error || !data) return {}

  const latest: Record<string, TradeMessage> = {}
  for (const row of data as MessageRow[]) {
    if (!latest[row.trade_id]) {
      latest[row.trade_id] = mapMessage(row)
    }
  }
  return latest
}

export async function addTradeMessage(
  supabase: SupabaseClient,
  tradeId: string,
  senderId: string,
  body: string,
  messageType: TradeMessageType = "text",
): Promise<{ message: TradeMessage | null; error: string | null }> {
  const trimmed = body.trim()
  if (!trimmed && messageType === "text") {
    return { message: null, error: "Message cannot be empty" }
  }

  const { data, error } = await supabase
    .from("trade_messages")
    .insert({
      trade_id: tradeId,
      sender_id: senderId,
      body: trimmed,
      message_type: messageType,
    })
    .select("*")
    .single()

  if (error || !data) return { message: null, error: error?.message ?? "Could not send message" }
  return { message: mapMessage(data as MessageRow), error: null }
}
