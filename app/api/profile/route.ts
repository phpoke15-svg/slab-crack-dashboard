import { NextRequest, NextResponse } from "next/server"
import { ensureProfile, updateProfile } from "@/lib/trade-binder/profile-db"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const profile = await ensureProfile(auth.supabase, auth.user.id, auth.user.email)
  return NextResponse.json({ profile })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const { profile, error } = await updateProfile(auth.supabase, auth.user.id, {
    displayName: body.displayName,
    handle: body.handle,
    bio: body.bio,
    location: body.location,
    avatarUrl: body.avatarUrl,
    binderVisibility: body.binderVisibility,
  })

  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ profile })
}
