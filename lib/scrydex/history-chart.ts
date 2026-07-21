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

/** Map a price_history_daily row to a chart column key (raw, psa10, slab:BGS|9.5, …). */
export function gradeTypeFromHistoryRow(row: DailyHistoryRow): string | null {
  if ((row.variant ?? "normal") !== "normal") return null

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

/** Pivot daily rows into Recharts-friendly objects keyed by recorded_at. */
export function pivotHistoryRowsForChart(rows: DailyHistoryRow[]): ScrydexHistoryChartRow[] {
  const chartDataMap = new Map<string, ScrydexHistoryChartRow>()

  for (const row of rows) {
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
