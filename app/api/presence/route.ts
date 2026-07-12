import { NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { touchLastSeen } from "@/lib/presence"

export const dynamic = "force-dynamic"

/** Lightweight heartbeat so Site Insights can count active users. */
export async function POST() {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  await touchLastSeen(auth.user.id)
  return NextResponse.json({ ok: true })
}
