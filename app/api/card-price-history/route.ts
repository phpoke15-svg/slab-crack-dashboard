import { NextResponse } from "next/server"
import {
  ensureCardDailyPriceHistory,
  getCardDailyPriceHistorySeries,
} from "@/lib/pricing/card-daily-price-history"
import { ensureCardPriceHistory } from "@/lib/pricing/lazy-price-history"
import {
  getPriceHistorySeriesMap,
  priceHistorySeriesLabels,
} from "@/lib/pricing/price-history-series"
import { isScrydexConfigured, resolveCatalogId } from "@/lib/scrydex/constants"
import { SCRYDEX_PRICE_HISTORY_LABELS } from "@/lib/tcg-research/scrydex-price-history"
import type { PriceHistorySeriesKey } from "@/lib/pricing/types"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const RANGE_PRESETS = {
  "30": 30,
  "90": 90,
  "365": 365,
  all: 0,
} as const

type RangePreset = keyof typeof RANGE_PRESETS

function parseRange(value: string | null): { days: number; full: boolean; preset: RangePreset } {
  const normalized = (value ?? "90").trim().toLowerCase()
  if (normalized === "all" || normalized === "0") {
    return { days: 0, full: true, preset: "all" }
  }
  const days = Number(normalized)
  if (Number.isFinite(days) && days > 0) {
    return { days: Math.min(Math.round(days), 3650), full: false, preset: "90" }
  }
  const preset = normalized in RANGE_PRESETS ? (normalized as RangePreset) : "90"
  const presetDays = RANGE_PRESETS[preset]
  return { days: presetDays, full: presetDays === 0, preset }
}

function filterSeriesByDays<T extends { date: string }>(points: T[], days: number): T[] {
  if (days <= 0 || points.length === 0) return points
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  const sinceDate = since.toISOString().slice(0, 10)
  return points.filter((point) => point.date >= sinceDate)
}

/** Price history for Slab Labs charts — Scrydex daily cache with TCGGO fallback. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim()
  const rangeParam = searchParams.get("range") ?? searchParams.get("days")
  const { days, full } = parseRange(rangeParam)

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  try {
    const catalogId = resolveCatalogId(id)

    if (catalogId && isScrydexConfigured()) {
      const ensure = await ensureCardDailyPriceHistory(id)
      const { series, range } = await getCardDailyPriceHistorySeries(id, days)
      const filtered = Object.fromEntries(
        Object.entries(series).map(([key, points]) => [key, filterSeriesByDays(points, days)]),
      ) as Record<PriceHistorySeriesKey, (typeof series)[PriceHistorySeriesKey]>

      const counts = Object.fromEntries(
        Object.entries(filtered).map(([key, points]) => [key, points.length]),
      ) as Record<PriceHistorySeriesKey, number>

      const hasChartableSeries = Object.values(filtered).some((points) => points.length >= 2)
      if (hasChartableSeries) {
        return NextResponse.json({
          cardId: id,
          catalogId: ensure.catalogId,
          days,
          full,
          labels: SCRYDEX_PRICE_HISTORY_LABELS,
          highlightKey: "psa9",
          series: filtered,
          counts,
          range,
          source: "scrydex",
          backfill: ensure,
        })
      }
    }

    await ensureCardPriceHistory(id, { days: days || 30, full, force: full })

    const { series, range } = await getPriceHistorySeriesMap(id, 0)
    const filtered = Object.fromEntries(
      Object.entries(series).map(([key, points]) => [key, filterSeriesByDays(points, days)]),
    ) as Record<PriceHistorySeriesKey, (typeof series)[PriceHistorySeriesKey]>

    const counts = Object.fromEntries(
      Object.entries(filtered).map(([key, points]) => [key, points.length]),
    ) as Record<PriceHistorySeriesKey, number>

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
