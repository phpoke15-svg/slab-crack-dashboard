import type { SupabaseClient } from "@supabase/supabase-js"
import type { FriendshipStatus } from "@/lib/trade-binder/users"

type FriendshipRow = {
  id: string
  requester_id: string
  addressee_id: string
  status: "pending" | "accepted"
}

export async function listFriendIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "accepted")

  if (error || !data) return []
  return data.map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id))
}

export async function getFriendshipStatus(
  supabase: SupabaseClient,
  userId: string,
  otherId: string,
): Promise<FriendshipStatus> {
  const { data } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`,
    )
    .maybeSingle()

  if (!data) return "none"
  if (data.status === "accepted") return "accepted"
  if (data.requester_id === userId) return "pending_outgoing"
  return "pending_incoming"
}

export async function sendFriendRequest(
  supabase: SupabaseClient,
  requesterId: string,
  addresseeId: string,
): Promise<{ error: string | null }> {
  const status = await getFriendshipStatus(supabase, requesterId, addresseeId)
  if (status === "accepted") return { error: "Already friends" }
  if (status === "pending_outgoing") return { error: "Request already sent" }

  if (status === "pending_incoming") {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .or(
        `and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId}),and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId})`,
      )
    return { error: error?.message ?? null }
  }

  const { error } = await supabase.from("friendships").insert({
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: "pending",
  })
  return { error: error?.message ?? null }
}

export async function removeFriendship(
  supabase: SupabaseClient,
  userId: string,
  otherId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`,
    )
  return { error: error?.message ?? null }
}

export async function listFriendshipRows(
  supabase: SupabaseClient,
  userId: string,
): Promise<FriendshipRow[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  if (error || !data) return []
  return data as FriendshipRow[]
}
