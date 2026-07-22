import { variantSortRank } from "@/lib/scrydex/variant-prices"

type DailyHistoryRow = {
  snapshot_date?: string | null
  price_type?: string | null
  variant?: string | null
  condition?: string | null
  company?: string | null
  grade?: string | null
  market_price?: number | null
}

export type ScrydexHistoryChartRow = {
  recorded_at: string
  [gradeType: string]: string | number
}

export type RechartsHistoryRow = {
  recorded_at: string
  RAW?: number
  PSA_10?: number
  PSA_9?: number
  PSA_8?: number
  PSA_7?: number
}

const RECHARTS_GRADE_KEYS: Record<string, keyof RechartsHistoryRow> = {
  raw: "RAW",
  psa10: "PSA_10",
  psa9: "PSA_9",
  psa8: "PSA_8",
  psa7: "PSA_7",
}

/** Map a price_history_daily row to a chart column key (raw, psa10, slab:BGS|9.5, …). */
export function gradeTypeFromHistoryRow(row: DailyHistoryRow): string | null {
  const price = Number(row.market_price ?? 0)
  if (price <= 0) return null

  if (row.price_type === "raw" || (!row.company && !row.grade)) {
    if ((row.condition ?? "NM") !== "NM") return null
    return "raw"
  }

  const company = String(row.company ?? "").trim().toUpperCase()
  const grade = String(row.grade ?? "").trim()
  if (!company || !grade) return null

  if (company === "PSA") {
    if (grade === "7") return "psa7"
    if (grade === "8") return "psa8"
    if (grade === "9") return "psa9"
    if (grade === "10") return "psa10"
  }

  return `slab:${company}|${grade}`
}

/** Prefer normal, then holo/foil, when multiple variants share the same date + grade bucket. */
export function pickPreferredHistoryRowsForChart(rows: DailyHistoryRow[]): DailyHistoryRow[] {
  const byKey = new Map<string, DailyHistoryRow>()

  for (const row of rows) {
    const gradeType = gradeTypeFromHistoryRow(row)
    const recordedAt = String(row.snapshot_date ?? "").slice(0, 10)
    if (!gradeType || !recordedAt) continue

    const key = `${recordedAt}|${gradeType}`
    const existing = byKey.get(key)
    if (!existing || variantSortRank(row.variant) < variantSortRank(existing.variant)) {
      byKey.set(key, row)
    }
  }

  return [...byKey.values()]
}

/** Pivot daily rows into Recharts-friendly objects keyed by recorded_at. */
export function pivotHistoryRowsForChart(rows: DailyHistoryRow[]): ScrydexHistoryChartRow[] {
  const chartDataMap = new Map<string, ScrydexHistoryChartRow>()

  for (const row of pickPreferredHistoryRowsForChart(rows)) {
    const gradeType = gradeTypeFromHistoryRow(row)
    const recordedAt = String(row.snapshot_date ?? "").slice(0, 10)
    if (!gradeType || !recordedAt) continue

    const price = Number(row.market_price ?? 0)
    if (price <= 0) continue

    const existing = chartDataMap.get(recordedAt) ?? { recorded_at: recordedAt }
    existing[gradeType] = price
    chartDataMap.set(recordedAt, existing)
  }

  return [...chartDataMap.values()].sort((a, b) =>
    String(a.recorded_at).localeCompare(String(b.recorded_at)),
  )
}

/** Map pivot rows to Recharts dataKeys (RAW, PSA_10, PSA_9, …). */
export function toRechartsHistoryRows(rows: ScrydexHistoryChartRow[]): RechartsHistoryRow[] {
  return rows.map((row) => {
    const mapped: RechartsHistoryRow = { recorded_at: String(row.recorded_at) }
    for (const [key, value] of Object.entries(row)) {
      if (key === "recorded_at") continue
      const rechartsKey = RECHARTS_GRADE_KEYS[key]
      if (rechartsKey && typeof value === "number" && value > 0) {
        mapped[rechartsKey] = value
      }
    }
    return mapped
  })
}
