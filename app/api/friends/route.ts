import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { notifyFriendRequest } from "@/lib/notifications/triggers"
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriendshipStatus,
  listFriendIds,
  listFriendRequests,
  removeFriendship,
  sendFriendRequest,
} from "@/lib/trade-binder/friends"
import { blockExclusionSet, listBlockRelations } from "@/lib/trade-binder/blocks"
import { fetchProfile } from "@/lib/trade-binder/profile-db"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

async function loadProfiles(supabase: SupabaseClient, ids: string[]) {
  const profiles = (
    await Promise.all(ids.map((id) => fetchProfile(supabase, id)))
  ).filter((p) => p !== null)
  return profiles
}

async function friendStateForUser(supabase: SupabaseClient, userId: string) {
  const relations = await listBlockRelations(supabase, userId)
  const exclude = blockExclusionSet(relations)
  const friendIds = (await listFriendIds(supabase, userId)).filter((id) => !exclude.has(id))
  const requests = (await listFriendRequests(supabase, userId)).filter(
    (r) => !exclude.has(r.userId),
  )
  const incomingRequestIds = requests
    .filter((r) => r.direction === "incoming")
    .map((r) => r.userId)
  const outgoingRequestIds = requests
    .filter((r) => r.direction === "outgoing")
    .map((r) => r.userId)
  const allIds = [...new Set([...friendIds, ...incomingRequestIds, ...outgoingRequestIds])]
  const profiles = await loadProfiles(supabase, allIds)

  return {
    friendIds,
    profiles,
    incomingRequestIds,
    outgoingRequestIds,
    requests,
  }
}

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json(await friendStateForUser(auth.supabase, auth.user.id))
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const otherId = body.userId as string | undefined
  if (!otherId) return NextResponse.json({ error: "userId required" }, { status: 400 })
  if (otherId === auth.user.id) return NextResponse.json({ error: "Invalid user" }, { status: 400 })

  const { error, friendshipId } = await sendFriendRequest(auth.supabase, auth.user.id, otherId)
  if (error) return NextResponse.json({ error }, { status: 400 })

  if (friendshipId) {
    void notifyFriendRequest({
      addresseeId: otherId,
      requesterId: auth.user.id,
      friendshipId,
    })
  }

  const status = await getFriendshipStatus(auth.supabase, auth.user.id, otherId)
  const state = await friendStateForUser(auth.supabase, auth.user.id)
  return NextResponse.json({ status, ...state })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const otherId = body.userId as string | undefined
  const action = body.action as "accept" | "decline" | undefined
  if (!otherId) return NextResponse.json({ error: "userId required" }, { status: 400 })
  if (!action) return NextResponse.json({ error: "action required" }, { status: 400 })

  const { error } =
    action === "accept"
      ? await acceptFriendRequest(auth.supabase, auth.user.id, otherId)
      : await declineFriendRequest(auth.supabase, auth.user.id, otherId)

  if (error) return NextResponse.json({ error }, { status: 400 })

  const status = await getFriendshipStatus(auth.supabase, auth.user.id, otherId)
  const state = await friendStateForUser(auth.supabase, auth.user.id)
  return NextResponse.json({ status, ...state })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const otherId = request.nextUrl.searchParams.get("userId")
  if (!otherId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  const { error } = await removeFriendship(auth.supabase, auth.user.id, otherId)
  if (error) return NextResponse.json({ error }, { status: 400 })
  const state = await friendStateForUser(auth.supabase, auth.user.id)
  return NextResponse.json({ ok: true, ...state })
}
