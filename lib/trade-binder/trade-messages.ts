import type { SupabaseClient } from "@supabase/supabase-js"
import { binderErrorMessage } from "@/lib/trade-binder/errors"
import type { TradeMessage, TradeMessageType } from "@/lib/trade-binder/users"

type MessageRow = {
  id: string
  trade_id: string
  sender_id: string
  body: string
  message_type: TradeMessageType
  image_url: string | null
  created_at: string
}

function mapMessage(row: MessageRow): TradeMessage {
  return {
    id: row.id,
    tradeId: row.trade_id,
    senderId: row.sender_id,
    body: row.body,
    messageType: row.message_type,
    imageUrl: row.image_url ?? "",
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

export async function listMessagesForTradeIds(
  supabase: SupabaseClient,
  tradeIds: string[],
): Promise<TradeMessage[]> {
  if (tradeIds.length === 0) return []

  const { data, error } = await supabase
    .from("trade_messages")
    .select("*")
    .in("trade_id", tradeIds)
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
  imageUrl = "",
): Promise<{ message: TradeMessage | null; error: string | null }> {
  const trimmed = body.trim()
  if (!trimmed && messageType === "text") {
    return { message: null, error: "Message cannot be empty" }
  }
  if (messageType === "image" && !imageUrl) {
    return { message: null, error: "Image is required" }
  }

  const { data, error } = await supabase
    .from("trade_messages")
    .insert({
      trade_id: tradeId,
      sender_id: senderId,
      body: trimmed,
      message_type: messageType,
      image_url: imageUrl,
    })
    .select("*")
    .single()

  if (error || !data) {
    return { message: null, error: binderErrorMessage(error, "Could not send message") }
  }
  return { message: mapMessage(data as MessageRow), error: null }
}

const CHAT_IMAGE_BUCKET = "chat-images"
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export async function uploadChatImage(
  supabase: SupabaseClient,
  tradeId: string,
  userId: string,
  file: File,
): Promise<{ path: string | null; publicUrl: string | null; error: string | null }> {
  if (!file.type.startsWith("image/")) {
    return { path: null, publicUrl: null, error: "Only image files are allowed." }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { path: null, publicUrl: null, error: "Image must be 5 MB or smaller." }
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const safeExt = ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext) ? ext : "jpg"
  const path = `${tradeId}/${userId}/${crypto.randomUUID()}.${safeExt}`

  const { error } = await supabase.storage.from(CHAT_IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || `image/${safeExt}`,
  })

  if (error) return { path: null, publicUrl: null, error: error.message }

  return { path, publicUrl: path, error: null }
}

export async function resolveChatImageUrl(
  supabase: SupabaseClient,
  storedUrl: string,
): Promise<string> {
  if (!storedUrl) return ""
  if (storedUrl.startsWith("http")) return storedUrl

  const { data, error } = await supabase.storage
    .from(CHAT_IMAGE_BUCKET)
    .createSignedUrl(storedUrl, 60 * 60 * 24 * 7)

  return error || !data?.signedUrl ? storedUrl : data.signedUrl
}

export async function resolveMessageImageUrls(
  supabase: SupabaseClient,
  messages: TradeMessage[],
): Promise<TradeMessage[]> {
  return Promise.all(
    messages.map(async (msg) => {
      if (!msg.imageUrl) return msg
      if (msg.imageUrl.startsWith("http")) return msg
      return { ...msg, imageUrl: await resolveChatImageUrl(supabase, msg.imageUrl) }
    }),
  )
}
