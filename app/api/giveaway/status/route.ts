import { NextResponse } from "next/server"
import { requireGiveawayAccess } from "@/lib/giveaway/access"
import { getGiveawayStatus } from "@/lib/giveaway/service"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const access = await requireGiveawayAccess(auth.user.id)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  try {
    const status = await getGiveawayStatus(auth.user.id)
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load giveaway status"
    const status = /not set up yet|not configured/i.test(message) ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
