import type { SupabaseClient } from "@supabase/supabase-js"

export type ChatReadState = {
  myLastReadAt: string | null
  partnerLastReadAt: string | null
}

type ReadRow = {
  user_id: string
  last_read_at: string
}

export async function getChatReadState(
  supabase: SupabaseClient,
  tradeId: string,
  userId: string,
  partnerId: string,
): Promise<ChatReadState> {
  const { data } = await supabase
    .from("trade_chat_reads")
    .select("user_id, last_read_at")
    .eq("trade_id", tradeId)

  const rows = (data ?? []) as ReadRow[]
  const mine = rows.find((r) => r.user_id === userId)
  const theirs = rows.find((r) => r.user_id === partnerId)

  return {
    myLastReadAt: mine?.last_read_at ?? null,
    partnerLastReadAt: theirs?.last_read_at ?? null,
  }
}

export async function markChatRead(
  supabase: SupabaseClient,
  tradeId: string,
  userId: string,
): Promise<void> {
  const now = new Date().toISOString()
  await supabase.from("trade_chat_reads").upsert(
    {
      trade_id: tradeId,
      user_id: userId,
      last_read_at: now,
    },
    { onConflict: "trade_id,user_id" },
  )
}

export function isMessageReadByPartner(
  messageCreatedAt: string,
  partnerLastReadAt: string | null,
): boolean {
  if (!partnerLastReadAt) return false
  return partnerLastReadAt >= messageCreatedAt
}
