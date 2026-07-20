import { NextResponse } from "next/server"
import { ensureCardPriceHistory } from "@/lib/pricing/lazy-price-history"
import { resolveHistoryCardIdAsync } from "@/lib/pricing/history-card-id"
import {
  getPriceHistorySeriesMap,
  priceHistorySeriesLabels,
} from "@/lib/pricing/price-history-series"
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
  const normalized = (value ?? "all").trim().toLowerCase()
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

/** Full pokemon-api.com price history — raw TCGPlayer + eBay PSA grades as separate series. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim()
  const pokemonTcgId = searchParams.get("pokemonTcgId")?.trim()
  const rangeParam = searchParams.get("range") ?? searchParams.get("days")
  const { days, full } = parseRange(rangeParam)

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const historyCardId = await resolveHistoryCardIdAsync(id, pokemonTcgId)

  try {
    await ensureCardPriceHistory(historyCardId, { days: days || 30, full, force: full })

    let { series, range } = await getPriceHistorySeriesMap(historyCardId, 0)
    let filtered = Object.fromEntries(
      Object.entries(series).map(([key, points]) => [
        key,
        filterSeriesByDays(points, days),
      ]),
    ) as Record<PriceHistorySeriesKey, (typeof series)[PriceHistorySeriesKey]>

    const totalFiltered = Object.values(filtered).reduce((sum, pts) => sum + pts.length, 0)
    if (full && totalFiltered < 10) {
      await ensureCardPriceHistory(historyCardId, { full: true, force: true })
      const refreshed = await getPriceHistorySeriesMap(historyCardId, 0)
      series = refreshed.series
      range = refreshed.range
      filtered = Object.fromEntries(
        Object.entries(series).map(([key, points]) => [
          key,
          filterSeriesByDays(points, days),
        ]),
      ) as Record<PriceHistorySeriesKey, (typeof series)[PriceHistorySeriesKey]>
    }

    const counts = Object.fromEntries(
      Object.entries(filtered).map(([key, points]) => [key, points.length]),
    ) as Record<PriceHistorySeriesKey, number>

    return NextResponse.json(
      {
        cardId: historyCardId,
        requestedId: id,
        days,
        full,
        labels: priceHistorySeriesLabels(),
        series: filtered,
        counts,
        range,
        source: "tcggo",
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load price history"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
