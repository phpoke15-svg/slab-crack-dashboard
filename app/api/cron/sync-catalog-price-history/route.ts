import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { syncTcgGoPriceHistory } from "@/lib/pricing/history-sync"

export const maxDuration = 300
export const dynamic = "force-dynamic"

/** Walk the full cards catalog and backfill price_history from TCGGO. */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const maxCardsParam = searchParams.get("maxCards")
  const daysParam = searchParams.get("days")
  const offsetParam = searchParams.get("offset")
  const maxCards = maxCardsParam ? Number(maxCardsParam) : undefined
  const days = daysParam ? Number(daysParam) : undefined
  const catalogOffset = offsetParam ? Number(offsetParam) : undefined

  try {
    const result = await syncTcgGoPriceHistory({
      mode: "catalog",
      full: searchParams.get("full") !== "0",
      maxCards: Number.isFinite(maxCards) && maxCards! > 0 ? maxCards : undefined,
      days: Number.isFinite(days) && days! > 0 ? days : undefined,
      catalogOffset: Number.isFinite(catalogOffset) && catalogOffset! >= 0 ? catalogOffset : undefined,
    })

    if (result.errors.length > 0 && result.historyPoints === 0 && result.processed === 0) {
      return NextResponse.json(result, { status: 503 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog price history sync failed"
    console.error("[sync-catalog-price-history] unhandled:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
