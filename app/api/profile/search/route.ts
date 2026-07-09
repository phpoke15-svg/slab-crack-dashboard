import { NextRequest, NextResponse } from "next/server"
import { blockExclusionSet, listBlockRelations } from "@/lib/trade-binder/blocks"
import { searchProfiles } from "@/lib/trade-binder/profile-db"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function GET(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const q = request.nextUrl.searchParams.get("q") ?? ""
  const relations = await listBlockRelations(auth.supabase, auth.user.id)
  const exclude = blockExclusionSet(relations)
  const profiles = (await searchProfiles(auth.supabase, q, auth.user.id)).filter(
    (p) => !exclude.has(p.id),
  )
  return NextResponse.json({ profiles })
}
