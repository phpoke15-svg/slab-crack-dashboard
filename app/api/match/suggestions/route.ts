import { NextRequest, NextResponse } from "next/server"
import { computeMatchSuggestions } from "@/lib/trade-binder/matching"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const toleranceParam = request.nextUrl.searchParams.get("tolerance")
  const tolerance = toleranceParam ? Number(toleranceParam) : undefined

  const result = await computeMatchSuggestions(auth.supabase, auth.user.id, tolerance)
  return NextResponse.json(result)
}
