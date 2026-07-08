import type { SupabaseClient } from "@supabase/supabase-js"
import type { FriendshipStatus } from "@/lib/trade-binder/users"

type FriendshipRow = {
  id: string
  requester_id: string
  addressee_id: string
  status: "pending" | "accepted"
}

async function findFriendshipBetween(
  supabase: SupabaseClient,
  userId: string,
  otherId: string,
): Promise<FriendshipRow | null> {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

  if (error || !data) return null

  return (
    data.find(
      (row) =>
        (row.requester_id === userId && row.addressee_id === otherId) ||
        (row.requester_id === otherId && row.addressee_id === userId),
    ) ?? null
  )
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
  const row = await findFriendshipBetween(supabase, userId, otherId)
  if (!row) return "none"
  if (row.status === "accepted") return "accepted"
  if (row.requester_id === userId) return "pending_outgoing"
  return "pending_incoming"
}

export async function sendFriendRequest(
  supabase: SupabaseClient,
  requesterId: string,
  addresseeId: string,
): Promise<{ error: string | null }> {
  const existing = await findFriendshipBetween(supabase, requesterId, addresseeId)
  if (existing?.status === "accepted") return { error: "Already friends" }

  if (existing) {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", existing.id)
    return { error: error?.message ?? null }
  }

  const { error } = await supabase.from("friendships").insert({
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: "accepted",
  })
  return { error: error?.message ?? null }
}

export async function removeFriendship(
  supabase: SupabaseClient,
  userId: string,
  otherId: string,
): Promise<{ error: string | null }> {
  const existing = await findFriendshipBetween(supabase, userId, otherId)
  if (!existing) return { error: null }

  const { error } = await supabase.from("friendships").delete().eq("id", existing.id)
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
