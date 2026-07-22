import { pickPreferredHistoryRowsForChart, gradeTypeFromHistoryRow } from "@/lib/scrydex/history-chart"
import type { AiWeeklyGradeType } from "@/lib/ai-weekly-picks/types"

type HistoryRow = {
  snapshot_date?: string | null
  price_type?: string | null
  variant?: string | null
  condition?: string | null
  company?: string | null
  grade?: string | null
  market_price?: number | null
}

function historyGradeKey(row: HistoryRow): string | null {
  const mapped = gradeTypeFromHistoryRow(row)
  if (mapped === "raw") return "RAW"
  if (mapped === "psa10") return "PSA_10"
  if (mapped === "psa9") return "PSA_9"
  return null
}

function priceSeriesByGrade(rows: HistoryRow[]): Record<string, Array<{ date: string; price: number }>> {
  const preferred = pickPreferredHistoryRowsForChart(rows)
  const series: Record<string, Array<{ date: string; price: number }>> = {
    RAW: [],
    PSA_10: [],
    PSA_9: [],
  }

  for (const row of preferred) {
    const key = historyGradeKey(row)
    const date = String(row.snapshot_date ?? "").slice(0, 10)
    const price = Number(row.market_price ?? 0)
    if (!key || !date || price <= 0) continue
    series[key]!.push({ date, price })
  }

  for (const key of Object.keys(series)) {
    const byDate = new Map<string, number>()
    for (const point of series[key]!) {
      byDate.set(point.date, point.price)
    }
    series[key] = [...byDate.entries()]
      .map(([date, price]) => ({ date, price }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  return series
}

function priceOnOrBefore(series: Array<{ date: string; price: number }>, targetDate: string): number | null {
  let last: number | null = null
  for (const point of series) {
    if (point.date > targetDate) break
    last = point.price
  }
  return last
}

export function computeMomentum30dPct(rows: HistoryRow[], grade: AiWeeklyGradeType): number {
  const series = priceSeriesByGrade(rows)[grade] ?? []
  if (series.length < 2) return 0

  const latest = series[series.length - 1]!
  const target = new Date(`${latest.date}T00:00:00Z`)
  target.setUTCDate(target.getUTCDate() - 30)
  const targetDate = target.toISOString().slice(0, 10)
  const prior = priceOnOrBefore(series, targetDate) ?? series[0]!.price
  if (prior <= 0) return 0
  return ((latest.price - prior) / prior) * 100
}

/** Distinct history snapshots in the last 30 days — proxy for market activity / supply turnover. */
export function computeSupplyVelocity(rows: HistoryRow[]): number {
  if (rows.length === 0) return 0
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 30)
  const sinceDate = since.toISOString().slice(0, 10)
  const dates = new Set(
    rows
      .map((row) => String(row.snapshot_date ?? "").slice(0, 10))
      .filter((date) => date >= sinceDate),
  )
  return dates.size
}

export function computeSpreadRatio(rawPrice: number, psa10Price: number): number {
  if (rawPrice <= 0 || psa10Price <= 0) return 0
  return psa10Price / rawPrice
}

export function recommendGradeType(
  rawPrice: number,
  psa10Price: number,
  momentumRaw: number,
  momentumPsa10: number,
  spreadRatio: number,
): AiWeeklyGradeType {
  const gradingUpside = spreadRatio >= 1.35 && momentumPsa10 >= momentumRaw
  if (gradingUpside && psa10Price < 1000) return "PSA_10"
  if (rawPrice > 0 && rawPrice < 1000 && momentumRaw >= momentumPsa10) return "RAW"
  if (psa10Price > 0 && psa10Price < 1000) return "PSA_10"
  return "RAW"
}

export function priceTargetForGrade(
  grade: AiWeeklyGradeType,
  rawPrice: number,
  psa10Price: number,
  momentumPct: number,
): number {
  const base = grade === "PSA_10" ? psa10Price : rawPrice
  const uplift = Math.max(0.05, Math.min(0.25, momentumPct / 100 + 0.08))
  return Number((base * (1 + uplift)).toFixed(2))
}

export function priceFromHistoryRows(
  rows: HistoryRow[],
  grade: AiWeeklyGradeType,
  onDate?: string,
): number | null {
  const series = priceSeriesByGrade(rows)[grade] ?? []
  if (series.length === 0) return null
  if (onDate) return priceOnOrBefore(series, onDate)
  return series[series.length - 1]!.price
}
