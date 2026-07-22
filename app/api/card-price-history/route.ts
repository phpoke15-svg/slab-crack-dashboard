import { NextResponse } from "next/server"
import { ensureCardPriceHistory } from "@/lib/pricing/lazy-price-history"
import {
  getPriceHistorySeriesMap,
  priceHistorySeriesLabels,
} from "@/lib/pricing/price-history-series"
import { isScrydexConfigured, resolveCatalogId } from "@/lib/scrydex/constants"
import { parsePriceHistoryRange } from "@/lib/pricing/price-history-range"
import { normalizeGradingCompany } from "@/lib/grading/types"
import {
  loadTcgResearchScrydexPriceHistory,
  SCRYDEX_PRICE_HISTORY_LABELS,
} from "@/lib/tcg-research/scrydex-price-history"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Price history for Slab Labs charts — Scrydex-only when configured. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim()
  const catalogIdParam = searchParams.get("catalogId")?.trim() || undefined
  const scrydexId = searchParams.get("scrydexId")?.trim() || undefined
  const game = searchParams.get("game")?.trim() || undefined
  const company = normalizeGradingCompany(searchParams.get("company"))
  const grade = searchParams.get("grade")?.trim() || undefined
  const rangeParam = searchParams.get("range") ?? searchParams.get("days")
  const { days, full } = parsePriceHistoryRange(rangeParam)

  if (!id && !catalogIdParam && !scrydexId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const catalogId =
    catalogIdParam ??
    (scrydexId && game ? `${game}-${scrydexId}` : null) ??
    (id ? resolveCatalogId(id) : null)

  try {
    if (catalogId && isScrydexConfigured()) {
      const { series, range, labels, highlightKey } = await loadTcgResearchScrydexPriceHistory({
        catalogId,
        scrydexId,
        game: game as "pokemon" | "lorcana" | "mtg" | undefined,
        days: days || 90,
        company,
        grade,
      })

      const counts = Object.fromEntries(
        Object.entries(series).map(([key, points]) => [key, points.length]),
      )

      const hasChartableSeries = Object.values(series).some((points) => points.length >= 1)
      if (hasChartableSeries) {
        return NextResponse.json({
          cardId: id ?? catalogId,
          catalogId,
          days,
          full,
          labels: labels ?? SCRYDEX_PRICE_HISTORY_LABELS,
          highlightKey,
          series,
          counts,
          range,
          source: "scrydex",
        })
      }

      return NextResponse.json({
        cardId: id ?? catalogId,
        catalogId,
        days,
        full,
        labels: labels ?? SCRYDEX_PRICE_HISTORY_LABELS,
        highlightKey: highlightKey ?? "raw",
        series,
        counts,
        range,
        source: "scrydex",
      })
    }

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    await ensureCardPriceHistory(id, { days: days || 30, full, force: full })

    const { series, range } = await getPriceHistorySeriesMap(id, 0)
    const filtered = Object.fromEntries(
      Object.entries(series).map(([key, points]) => [key, points]),
    )

    const counts = Object.fromEntries(
      Object.entries(filtered).map(([key, points]) => [key, points.length]),
    )

    return NextResponse.json({
      cardId: id,
      days,
      full,
      labels: priceHistorySeriesLabels(),
      series: filtered,
      counts,
      range,
      source: "tcggo",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load price history"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
