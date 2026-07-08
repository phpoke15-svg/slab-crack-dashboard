import { NextRequest, NextResponse } from "next/server"
import { binderAccessMessage, canViewBinderByPolicy, resolveBinderAccess } from "@/lib/trade-binder/binder-access"
import { loadBinderCards } from "@/lib/trade-binder/binder"
import { listFriendIds } from "@/lib/trade-binder/friends"
import { fetchProfile } from "@/lib/trade-binder/profile-db"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { userId } = await params
  const profile = await fetchProfile(auth.supabase, userId)
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const isSelf = auth.user.id === userId
  const friendIds = isSelf ? [] : await listFriendIds(auth.supabase, auth.user.id)
  const isFriend = friendIds.includes(userId)

  const allowed = canViewBinderByPolicy({
    binderVisibility: profile.binderVisibility,
    isSelf,
    isFriend,
  })

  if (!allowed) {
    const access = resolveBinderAccess({ profile, isSelf, isFriend, cardCount: 0 })
    return NextResponse.json({
      profile,
      trade: [],
      wishlist: [],
      access,
      message: binderAccessMessage(access),
    })
  }

  const cards = await loadBinderCards(auth.supabase, userId)
  const trade = cards.filter((c) => c.status === "trade")
  const wishlist = cards.filter((c) => c.status === "wishlist")
  const access = resolveBinderAccess({
    profile,
    isSelf,
    isFriend,
    cardCount: trade.length + wishlist.length,
  })

  return NextResponse.json({
    profile,
    trade,
    wishlist,
    access,
    message: binderAccessMessage(access),
  })
}
