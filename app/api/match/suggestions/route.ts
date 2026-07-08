import { NextResponse } from "next/server"
import { computeMatchSuggestions } from "@/lib/trade-binder/matching"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const suggestions = await computeMatchSuggestions(auth.supabase, auth.user.id)
  return NextResponse.json({ suggestions })
}
