import { NextRequest, NextResponse } from "next/server"
import { searchProfiles } from "@/lib/trade-binder/profile-db"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function GET(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const q = request.nextUrl.searchParams.get("q") ?? ""
  const profiles = await searchProfiles(auth.supabase, q, auth.user.id)
  return NextResponse.json({ profiles })
}
