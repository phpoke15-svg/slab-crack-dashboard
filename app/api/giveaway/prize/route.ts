import { NextResponse } from "next/server"
import { requireGiveawayAccess } from "@/lib/giveaway/access"
import { monthPeriod } from "@/lib/giveaway/constants"
import { getPrizeSnapshotForMonth, listRecentGiveawayDraws } from "@/lib/giveaway/service"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

/** Supreme preview: current month prize ARV + recent draw log. */
export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const access = await requireGiveawayAccess(auth.user.id)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  const url = new URL(request.url)
  const month = url.searchParams.get("month")?.trim() || monthPeriod()

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ ok: false, error: "Invalid month (use YYYY-MM)" }, { status: 400 })
  }

  try {
    const [prize, recentDraws] = await Promise.all([
      getPrizeSnapshotForMonth(month),
      listRecentGiveawayDraws(6),
    ])
    return NextResponse.json({ ok: true, prize, recentDraws })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load prize info"
    const status = /not set up yet|not configured/i.test(message) ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
