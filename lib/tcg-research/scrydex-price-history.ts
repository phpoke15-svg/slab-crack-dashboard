import { catalogIdToLegacyPokeId, isScrydexConfigured, splitCatalogId } from "@/lib/scrydex/constants"
import { loadCardBundle } from "@/lib/scrydex/db"
import { SCRYDEX_CACHE } from "@/lib/scrydex/types"
import { ensureCardDailyPriceHistory } from "@/lib/pricing/card-daily-price-history"
import {
  formatSlabLabel,
  gradesForCompany,
  normalizeGradingCompany,
  type GradingCompany,
  type SlabGradeRef,
} from "@/lib/grading/types"
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

export type ScrydexHistoryPoint = { date: string; price: number }

const PSA_SERIES_KEYS: PriceHistorySeriesKey[] = ["raw", "psa7", "psa8", "psa9", "psa10"]

export const SCRYDEX_PRICE_HISTORY_LABELS: Record<PriceHistorySeriesKey, string> = {
  raw: "Scrydex Raw NM",
  psa7: "Scrydex PSA 7",
  psa8: "Scrydex PSA 8",
  psa9: "Scrydex PSA 9",
  psa10: "Scrydex PSA 10",
}

function seriesKeyForPsaRow(row: HistoryRow): PriceHistorySeriesKey | null {
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

function dynamicSeriesKey(company: GradingCompany, grade: string): string {
  return `slab:${company}|${grade}`
}

function filterRowsByDays(rows: HistoryRow[], days: number): HistoryRow[] {
  if (days <= 0 || rows.length === 0) return rows
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  const sinceDate = since.toISOString().slice(0, 10)
  return rows.filter((row) => String(row.snapshot_date ?? "") >= sinceDate)
}

function dedupeSeries(points: ScrydexHistoryPoint[]): ScrydexHistoryPoint[] {
  const byDate = new Map<string, number>()
  for (const point of points) {
    byDate.set(point.date, point.price)
  }
  return [...byDate.entries()]
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function scrydexHistoryRowsToSeriesMap(rows: HistoryRow[], days: number) {
  const filtered = filterRowsByDays(rows, days)
  const series = Object.fromEntries(PSA_SERIES_KEYS.map((key) => [key, [] as ScrydexHistoryPoint[]])) as Record<
    PriceHistorySeriesKey,
    ScrydexHistoryPoint[]
  >

  for (const row of filtered) {
    const key = seriesKeyForPsaRow(row)
    const price = Number(row.market_price ?? 0)
    const date = String(row.snapshot_date ?? "").slice(0, 10)
    if (!key || !date || price <= 0) continue
    series[key].push({ date, price })
  }

  for (const key of PSA_SERIES_KEYS) {
    series[key] = dedupeSeries(series[key])
  }

  const allDates = PSA_SERIES_KEYS.flatMap((key) => series[key].map((point) => point.date)).sort()
  return {
    series,
    range: {
      from: allDates[0] ?? null,
      to: allDates[allDates.length - 1] ?? null,
    },
  }
}

export function scrydexHistoryRowsToCompanySeriesMap(
  rows: HistoryRow[],
  days: number,
  company: GradingCompany,
  selected?: SlabGradeRef | null,
) {
  const filtered = filterRowsByDays(rows, days)
  const gradeList = gradesForCompany(
    company,
    filtered
      .filter((row) => normalizeGradingCompany(row.company ?? undefined) === company)
      .map((row) => ({ company: company, grade: String(row.grade ?? "") })),
  )

  const series: Record<string, ScrydexHistoryPoint[]> = { raw: [] }
  const labels: Record<string, string> = { raw: "Scrydex Raw NM" }

  for (const grade of gradeList) {
    const key = dynamicSeriesKey(company, grade)
    series[key] = []
    labels[key] = `Scrydex ${formatSlabLabel({ company, grade })}`
  }

  for (const row of filtered) {
    const price = Number(row.market_price ?? 0)
    const date = String(row.snapshot_date ?? "").slice(0, 10)
    if (!date || price <= 0) continue

    if (row.price_type === "raw" || (!row.company && !row.grade)) {
      if ((row.condition ?? "NM") !== "NM") continue
      series.raw!.push({ date, price })
      continue
    }

    const rowCompany = normalizeGradingCompany(row.company ?? undefined)
    if (rowCompany !== company) continue
    const grade = String(row.grade ?? "").trim()
    if (!grade) continue
    const key = dynamicSeriesKey(company, grade)
    if (!series[key]) {
      series[key] = []
      labels[key] = `Scrydex ${formatSlabLabel({ company, grade })}`
    }
    series[key].push({ date, price })
  }

  for (const key of Object.keys(series)) {
    series[key] = dedupeSeries(series[key] ?? [])
  }

  const selectedRef = selected ?? { company, grade: gradeList.includes("9") ? "9" : gradeList[0] ?? "10" }
  const highlightKey = dynamicSeriesKey(selectedRef.company, selectedRef.grade)

  const allDates = Object.values(series)
    .flatMap((points) => points.map((point) => point.date))
    .sort()

  return {
    series,
    labels,
    highlightKey,
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
  company?: GradingCompany
  grade?: string | null
}): Promise<{
  series: Record<string, ScrydexHistoryPoint[]>
  labels: Record<string, string>
  highlightKey?: string
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
      const cardId = catalogIdToLegacyPokeId(catalogId) ?? catalogId
      await ensureCardDailyPriceHistory(cardId)
      bundle = await loadCardBundle(catalogId)
      history = (bundle?.history ?? []) as HistoryRow[]
    } catch (error) {
      console.warn("[tcg-research/price-history] Scrydex history refresh failed:", error)
    }
  }

  const company = normalizeGradingCompany(input.company)
  if (company !== "PSA" || input.grade) {
    const mapped = scrydexHistoryRowsToCompanySeriesMap(history, input.days, company, {
      company,
      grade: String(input.grade ?? "9"),
    })
    return { ...mapped, source: "scrydex" }
  }

  const mapped = scrydexHistoryRowsToSeriesMap(history, input.days)
  return {
    series: mapped.series,
    labels: SCRYDEX_PRICE_HISTORY_LABELS,
    highlightKey: "psa9",
    range: mapped.range,
    source: "scrydex",
  }
}
