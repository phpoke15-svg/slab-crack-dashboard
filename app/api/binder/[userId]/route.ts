import { NextRequest, NextResponse } from "next/server"
import { usersAreBlockedEitherWay } from "@/lib/trade-binder/blocks"
import { binderAccessMessage, canViewBinderByPolicy, resolveBinderAccess } from "@/lib/trade-binder/binder-access"
import { loadBinderCards } from "@/lib/trade-binder/binder"
import { readerForBinderLoad } from "@/lib/trade-binder/cross-user-client"
import { listFriendIds } from "@/lib/trade-binder/friends"
import { ensureProfile, fetchProfile } from "@/lib/trade-binder/profile-db"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const maxDuration = 30

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { userId } = await params
  const isSelf = auth.user.id === userId
  if (!isSelf && (await usersAreBlockedEitherWay(auth.supabase, auth.user.id, userId))) {
    return NextResponse.json({ error: "Binder unavailable", blocked: true }, { status: 403 })
  }

  const readClient = readerForBinderLoad(auth.user.id, userId, auth.supabase)

  let profile = await fetchProfile(readClient, userId)
  if (!profile && isSelf) {
    profile = await ensureProfile(auth.supabase, auth.user.id, auth.user.email)
  }
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

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

  const cards = await loadBinderCards(readClient, userId)
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
