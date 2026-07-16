import { NextResponse } from "next/server"
import { requireGiveawayAccess } from "@/lib/giveaway/access"
import { monthPeriod } from "@/lib/giveaway/constants"
import { getGiveawayPrizeCards } from "@/lib/giveaway/prize-cards"
import { getPrizeSnapshotForMonth } from "@/lib/giveaway/service"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Supreme preview: cards near today's running giveaway prize ARV. */
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
    const prize = await getPrizeSnapshotForMonth(month)
    const { band, cards, usedLivePriceCharting } = await getGiveawayPrizeCards(prize.prizeArvUsd)

    return NextResponse.json({
      ok: true,
      prize,
      priceBand: band,
      cards,
      usedLivePriceCharting,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load prize cards"
    const status = /not set up yet|not configured/i.test(message) ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
