import { NextResponse } from "next/server"
import {
  loadTcgResearchScrydexPriceHistory,
  SCRYDEX_PRICE_HISTORY_LABELS,
} from "@/lib/tcg-research/scrydex-price-history"
import { parseTcgResearchGame } from "@/lib/tcg-research/search"
import { resolveCatalogId } from "@/lib/scrydex/constants"
import { parsePriceHistoryRange } from "@/lib/pricing/price-history-range"
import type { PriceHistorySeriesKey } from "@/lib/pricing/types"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim() || undefined
  const scrydexId = searchParams.get("scrydexId")?.trim() || undefined
  const catalogIdParam = searchParams.get("catalogId")?.trim() || undefined
  const game = parseTcgResearchGame(searchParams.get("game"))
  const rangeParam = searchParams.get("range") ?? searchParams.get("days")
  const { days, full } = parsePriceHistoryRange(rangeParam)

  const catalogId =
    catalogIdParam ??
    (scrydexId && game ? `${game}-${scrydexId}` : null) ??
    (id ? resolveCatalogId(id) : null)

  if (!catalogId) {
    return NextResponse.json({ error: "catalogId, scrydexId, or id required" }, { status: 400 })
  }

  try {
    const { series, range, source } = await loadTcgResearchScrydexPriceHistory({
      catalogId,
      scrydexId,
      game,
      days: days || 90,
    })

    const counts = Object.fromEntries(
      Object.entries(series).map(([key, points]) => [key, points.length]),
    ) as Record<PriceHistorySeriesKey, number>

    return NextResponse.json({
      catalogId,
      days,
      full,
      labels: SCRYDEX_PRICE_HISTORY_LABELS,
      series,
      counts,
      range,
      source,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load price history"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
