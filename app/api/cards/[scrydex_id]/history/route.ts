import { NextResponse } from "next/server"
import { ensureCardDailyPriceHistory } from "@/lib/pricing/card-daily-price-history"
import { parsePriceHistoryRange } from "@/lib/pricing/price-history-range"
import { pivotHistoryRowsForChart } from "@/lib/scrydex/history-chart"
import { isScrydexConfigured, toCatalogId } from "@/lib/scrydex/constants"
import { loadDailyHistoryRows } from "@/lib/scrydex/db"
import { parseTcgResearchGame } from "@/lib/tcg-research/search"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(
  request: Request,
  context: { params: Promise<{ scrydex_id: string }> },
) {
  const { scrydex_id: scrydexIdRaw } = await context.params
  const scrydexId = decodeURIComponent(scrydexIdRaw).trim()

  if (!scrydexId) {
    return NextResponse.json({ error: "scrydex_id is required" }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const game = parseTcgResearchGame(searchParams.get("game"))
  const rangeParam = searchParams.get("range") ?? searchParams.get("days")
  const { days } = parsePriceHistoryRange(rangeParam)
  const catalogId = toCatalogId(game, scrydexId)
  const legacyCardId = game === "pokemon" ? `poke-${scrydexId}` : catalogId

  try {
    if (isScrydexConfigured()) {
      await ensureCardDailyPriceHistory(legacyCardId).catch((error) => {
        console.warn("[cards/history] Scrydex backfill failed:", catalogId, error)
      })
    }

    const rows = await loadDailyHistoryRows(catalogId, days || 90)
    const chartData = pivotHistoryRowsForChart(rows)

    if (searchParams.get("meta") === "1") {
      return NextResponse.json({
        scrydexId,
        catalogId,
        game,
        days: days || 90,
        count: chartData.length,
        data: chartData,
      })
    }

    return NextResponse.json(chartData)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load price history"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
