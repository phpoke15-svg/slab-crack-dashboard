import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { probeUnifiedPriceSync, syncUnifiedCardPrices } from "@/lib/pricing/sync"

export const maxDuration = 300
export const dynamic = "force-dynamic"

/** Unified daily price sync — writes card_prices + price_history. */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)

  if (searchParams.get("probe") === "1") {
    const probe = await probeUnifiedPriceSync()
    return NextResponse.json(probe, { status: probe.ok ? 200 : 503 })
  }

  const maxCardsParam = searchParams.get("maxCards")
  const maxCards = maxCardsParam ? Number(maxCardsParam) : undefined

  try {
    const result = await syncUnifiedCardPrices({
      maxCards: Number.isFinite(maxCards) && maxCards! > 0 ? maxCards : undefined,
    })

    if (result.errors.length > 0 && result.refreshed === 0 && result.processed === 0) {
      return NextResponse.json(result, { status: 503 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unified card price sync failed"
    console.error("[sync-card-prices] unhandled:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
