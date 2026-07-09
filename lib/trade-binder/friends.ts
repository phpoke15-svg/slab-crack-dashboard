import type { SupabaseClient } from "@supabase/supabase-js"
import type { FriendshipStatus } from "@/lib/trade-binder/users"
import { usersAreBlockedEitherWay } from "@/lib/trade-binder/blocks"

type FriendshipRow = {
  id: string
  requester_id: string
  addressee_id: string
  status: "pending" | "accepted"
}

export type FriendRequestSummary = {
  friendshipId: string
  userId: string
  direction: "incoming" | "outgoing"
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

export async function listFriendRequests(
  supabase: SupabaseClient,
  userId: string,
): Promise<FriendRequestSummary[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "pending")

  if (error || !data) return []

  return data.map((row) => ({
    friendshipId: row.id,
    userId: row.requester_id === userId ? row.addressee_id : row.requester_id,
    direction: row.addressee_id === userId ? "incoming" : "outgoing",
  }))
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
  if (await usersAreBlockedEitherWay(supabase, requesterId, addresseeId)) {
    return { error: "You cannot connect with this trader" }
  }

  const existing = await findFriendshipBetween(supabase, requesterId, addresseeId)
  if (existing?.status === "accepted") return { error: "Already friends" }

  if (existing?.status === "pending") {
    if (existing.requester_id === requesterId) {
      return { error: "Friend request already sent" }
    }
    return {
      error: "This trader already sent you a request — open Friends → Requests to accept",
    }
  }

  const { error } = await supabase.from("friendships").insert({
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: "pending",
  })
  return { error: error?.message ?? null }
}

export async function acceptFriendRequest(
  supabase: SupabaseClient,
  userId: string,
  otherId: string,
): Promise<{ error: string | null }> {
  const existing = await findFriendshipBetween(supabase, userId, otherId)
  if (!existing || existing.status !== "pending") {
    return { error: "No pending friend request" }
  }
  if (existing.addressee_id !== userId) {
    return { error: "Only the recipient can accept this request" }
  }

  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", existing.id)
  return { error: error?.message ?? null }
}

export async function declineFriendRequest(
  supabase: SupabaseClient,
  userId: string,
  otherId: string,
): Promise<{ error: string | null }> {
  const existing = await findFriendshipBetween(supabase, userId, otherId)
  if (!existing || existing.status !== "pending") return { error: null }

  const { error } = await supabase.from("friendships").delete().eq("id", existing.id)
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
