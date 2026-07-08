import { NextRequest, NextResponse } from "next/server"
import { loadBinderCards } from "@/lib/trade-binder/binder"
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

  const cards = await loadBinderCards(auth.supabase, userId)
  const trade = cards.filter((c) => c.status === "trade")
  const wishlist = cards.filter((c) => c.status === "wishlist")

  return NextResponse.json({ profile, trade, wishlist })
}
