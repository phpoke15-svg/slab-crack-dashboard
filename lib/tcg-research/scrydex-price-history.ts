import { createCatalogService } from "@/lib/scrydex/catalog-service"
import { isScrydexConfigured, splitCatalogId } from "@/lib/scrydex/constants"
import { loadCardBundle } from "@/lib/scrydex/db"
import { SCRYDEX_CACHE } from "@/lib/scrydex/types"
import type { PriceHistorySeriesKey } from "@/lib/pricing/types"
import type { TcgGame } from "@/lib/scrydex/types"

type HistoryRow = {
  snapshot_date?: string
  price_type?: string
  variant?: string
  condition?: string | null
  company?: string | null
  grade?: string | null
  market_price?: number | null
}

const SERIES_KEYS: PriceHistorySeriesKey[] = ["raw", "psa7", "psa8", "psa9", "psa10"]

export const SCRYDEX_PRICE_HISTORY_LABELS: Record<PriceHistorySeriesKey, string> = {
  raw: "Scrydex Raw NM",
  psa7: "Scrydex PSA 7",
  psa8: "Scrydex PSA 8",
  psa9: "Scrydex PSA 9",
  psa10: "Scrydex PSA 10",
}

function seriesKeyForRow(row: HistoryRow): PriceHistorySeriesKey | null {
  if ((row.variant ?? "normal") !== "normal") return null

  if (row.price_type === "raw" || (!row.company && !row.grade)) {
    if ((row.condition ?? "NM") !== "NM") return null
    return "raw"
  }

  if ((row.company ?? "").toUpperCase() !== "PSA") return null
  const grade = Number(row.grade)
  if (grade === 7) return "psa7"
  if (grade === 8) return "psa8"
  if (grade === 9) return "psa9"
  if (grade === 10) return "psa10"
  return null
}

function filterRowsByDays(rows: HistoryRow[], days: number): HistoryRow[] {
  if (days <= 0 || rows.length === 0) return rows
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  const sinceDate = since.toISOString().slice(0, 10)
  return rows.filter((row) => String(row.snapshot_date ?? "") >= sinceDate)
}

export function scrydexHistoryRowsToSeriesMap(rows: HistoryRow[], days: number) {
  const filtered = filterRowsByDays(rows, days)
  const series = Object.fromEntries(SERIES_KEYS.map((key) => [key, [] as { date: string; price: number }[]])) as Record<
    PriceHistorySeriesKey,
    { date: string; price: number }[]
  >

  for (const row of filtered) {
    const key = seriesKeyForRow(row)
    const price = Number(row.market_price ?? 0)
    const date = String(row.snapshot_date ?? "").slice(0, 10)
    if (!key || !date || price <= 0) continue
    series[key].push({ date, price })
  }

  for (const key of SERIES_KEYS) {
    const byDate = new Map<string, number>()
    for (const point of series[key]) {
      byDate.set(point.date, point.price)
    }
    series[key] = [...byDate.entries()]
      .map(([date, price]) => ({ date, price }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  const allDates = SERIES_KEYS.flatMap((key) => series[key].map((point) => point.date)).sort()
  return {
    series,
    range: {
      from: allDates[0] ?? null,
      to: allDates[allDates.length - 1] ?? null,
    },
  }
}

function isHistoryStale(rows: HistoryRow[]): boolean {
  if (rows.length === 0) return true
  const latest = rows
    .map((row) => String(row.snapshot_date ?? ""))
    .filter(Boolean)
    .sort()
    .at(-1)
  if (!latest) return true
  const latestMs = new Date(`${latest}T00:00:00Z`).getTime()
  return Date.now() - latestMs > SCRYDEX_CACHE.historyTtlMs
}

export async function loadTcgResearchScrydexPriceHistory(input: {
  catalogId?: string | null
  scrydexId?: string | null
  game?: TcgGame
  days: number
}): Promise<{
  series: Record<PriceHistorySeriesKey, { date: string; price: number }[]>
  range: { from: string | null; to: string | null }
  source: "scrydex"
}> {
  const catalogId =
    input.catalogId?.trim() ||
    (input.scrydexId && input.game ? `${input.game}-${input.scrydexId}` : null)

  if (!catalogId) {
    throw new Error("catalogId or scrydexId required")
  }

  if (!splitCatalogId(catalogId)) {
    throw new Error("Invalid Scrydex catalog id")
  }

  let bundle = await loadCardBundle(catalogId)
  let history = (bundle?.history ?? []) as HistoryRow[]

  if (isScrydexConfigured() && isHistoryStale(history)) {
    try {
      const service = createCatalogService()
      await service.ensureHistory(catalogId, input.days || 90)
      bundle = await loadCardBundle(catalogId)
      history = (bundle?.history ?? []) as HistoryRow[]
    } catch (error) {
      console.warn("[tcg-research/price-history] Scrydex history refresh failed:", error)
    }
  }

  const mapped = scrydexHistoryRowsToSeriesMap(history, input.days)
  return { ...mapped, source: "scrydex" }
}
