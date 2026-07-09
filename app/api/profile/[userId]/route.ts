import { NextRequest, NextResponse } from "next/server"
import { createCrossUserReader } from "@/lib/trade-binder/cross-user-client"
import { listBlockRelations } from "@/lib/trade-binder/blocks"
import { fetchProfile } from "@/lib/trade-binder/profile-db"
import { listReviewsForUser } from "@/lib/trade-binder/reviews"
import { averageRating } from "@/lib/trade-binder/users"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { userId } = await params
  const relations = await listBlockRelations(auth.supabase, auth.user.id)
  if (relations.blockedByIds.includes(userId)) {
    return NextResponse.json(
      { error: "Profile unavailable", blocked: true, blockedByThem: true },
      { status: 403 },
    )
  }

  const readClient = createCrossUserReader() ?? auth.supabase
  const profile = await fetchProfile(readClient, userId)
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const reviews = await listReviewsForUser(auth.supabase, userId)
  return NextResponse.json({
    profile,
    reviews,
    rating: averageRating(reviews),
    blockedByYou: relations.blockedIds.includes(userId),
  })
}
