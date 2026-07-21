import { NextResponse } from "next/server"
import {
  loadTcgResearchScrydexPriceHistory,
  SCRYDEX_PRICE_HISTORY_LABELS,
} from "@/lib/tcg-research/scrydex-price-history"
import { normalizeGradingCompany } from "@/lib/grading/types"
import { parseTcgResearchGame } from "@/lib/tcg-research/search"
import { resolveCatalogId } from "@/lib/scrydex/constants"
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

function parseRange(value: string | null): { days: number; full: boolean } {
  const normalized = (value ?? "90").trim().toLowerCase()
  if (normalized === "all" || normalized === "0") {
    return { days: 0, full: true }
  }
  const days = Number(normalized)
  if (Number.isFinite(days) && days > 0) {
    return { days: Math.min(Math.round(days), 3650), full: false }
  }
  const preset = normalized in RANGE_PRESETS ? (normalized as RangePreset) : "90"
  const presetDays = RANGE_PRESETS[preset]
  return { days: presetDays, full: presetDays === 0 }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim() || undefined
  const scrydexId = searchParams.get("scrydexId")?.trim() || undefined
  const catalogIdParam = searchParams.get("catalogId")?.trim() || undefined
  const game = parseTcgResearchGame(searchParams.get("game"))
  const company = normalizeGradingCompany(searchParams.get("company"))
  const grade = searchParams.get("grade")?.trim() || undefined
  const rangeParam = searchParams.get("range") ?? searchParams.get("days")
  const { days, full } = parseRange(rangeParam)

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

    return NextResponse.json({
      catalogId,
      company,
      grade,
      days,
      full,
      labels: labels ?? SCRYDEX_PRICE_HISTORY_LABELS,
      highlightKey,
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
