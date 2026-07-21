import { NextResponse } from "next/server"
import {
  loadTcgResearchScrydexPriceHistory,
  SCRYDEX_PRICE_HISTORY_LABELS,
} from "@/lib/tcg-research/scrydex-price-history"
import { normalizeGradingCompany } from "@/lib/grading/types"
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
  const company = normalizeGradingCompany(searchParams.get("company"))
  const grade = searchParams.get("grade")?.trim() || undefined
  const rangeParam = searchParams.get("range") ?? searchParams.get("days")
  const rawOnly = searchParams.get("rawOnly") === "1" || searchParams.get("rawOnly") === "true"
  const { days, full } = parsePriceHistoryRange(rangeParam)

  const catalogId =
    catalogIdParam ??
    (scrydexId && game ? `${game}-${scrydexId}` : null) ??
    (id ? resolveCatalogId(id) : null)

  if (!catalogId) {
    return NextResponse.json({ error: "catalogId, scrydexId, or id required" }, { status: 400 })
  }

  try {
    const { series, range, source, labels, highlightKey } = await loadTcgResearchScrydexPriceHistory({
      catalogId,
      scrydexId,
      game,
      days: days || 90,
      company,
      grade,
    })

    const counts = Object.fromEntries(
      Object.entries(series).map(([key, points]) => [key, points.length]),
    ) as Record<string, number>

    const filteredSeries = rawOnly ? { raw: series.raw ?? [] } : series
    const filteredLabels = rawOnly
      ? { raw: (labels ?? SCRYDEX_PRICE_HISTORY_LABELS).raw }
      : (labels ?? SCRYDEX_PRICE_HISTORY_LABELS)
    const filteredCounts = rawOnly
      ? ({ raw: counts.raw ?? 0 } as Record<string, number>)
      : counts

    return NextResponse.json({
      catalogId,
      company,
      grade,
      days,
      full,
      rawOnly,
      labels: filteredLabels,
      highlightKey: rawOnly ? "raw" : highlightKey,
      series: filteredSeries,
      counts: filteredCounts,
      range,
      source,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load price history"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
