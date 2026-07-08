import { NextRequest, NextResponse } from "next/server"
import {
  getFriendshipStatus,
  listFriendIds,
  removeFriendship,
  sendFriendRequest,
} from "@/lib/trade-binder/friends"
import { fetchProfile } from "@/lib/trade-binder/profile-db"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const friendIds = await listFriendIds(auth.supabase, auth.user.id)
  const profiles = (
    await Promise.all(friendIds.map((id) => fetchProfile(auth.supabase, id)))
  ).filter((p) => p !== null)

  return NextResponse.json({ friendIds, profiles })
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const otherId = body.userId as string | undefined
  if (!otherId) return NextResponse.json({ error: "userId required" }, { status: 400 })
  if (otherId === auth.user.id) return NextResponse.json({ error: "Invalid user" }, { status: 400 })

  const { error } = await sendFriendRequest(auth.supabase, auth.user.id, otherId)
  if (error) return NextResponse.json({ error }, { status: 400 })

  const status = await getFriendshipStatus(auth.supabase, auth.user.id, otherId)
  return NextResponse.json({ status })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const otherId = request.nextUrl.searchParams.get("userId")
  if (!otherId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  const { error } = await removeFriendship(auth.supabase, auth.user.id, otherId)
  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
