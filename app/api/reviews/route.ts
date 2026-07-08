import { NextRequest, NextResponse } from "next/server"
import { hasCompletedTradeWith } from "@/lib/trade-binder/trades"
import { listReviewsForUser, upsertReview } from "@/lib/trade-binder/reviews"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function GET(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const userId = request.nextUrl.searchParams.get("userId")
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  const reviews = await listReviewsForUser(auth.supabase, userId)
  return NextResponse.json({ reviews })
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const revieweeId = body.revieweeId as string | undefined
  const rating = Number(body.rating)
  if (!revieweeId || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "revieweeId and rating (1-5) required" }, { status: 400 })
  }

  const traded = await hasCompletedTradeWith(auth.supabase, auth.user.id, revieweeId)
  if (!traded) {
    return NextResponse.json({ error: "Complete a trade before leaving a review" }, { status: 403 })
  }

  const { review, error } = await upsertReview(
    auth.supabase,
    auth.user.id,
    revieweeId,
    rating,
    body.comment ?? "",
    body.tradeId,
  )

  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ review })
}
