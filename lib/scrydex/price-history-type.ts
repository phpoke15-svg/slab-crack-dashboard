export type PriceHistoryType = "raw" | "graded" | "both"

export function parsePriceHistoryType(value: string | null | undefined): PriceHistoryType {
  const normalized = (value ?? "both").trim().toLowerCase()
  if (normalized === "raw" || normalized === "graded") return normalized
  return "both"
}

export function resolvePriceHistoryDateRange(input: {
  days: number
  full: boolean
  fromParam?: string | null
  toParam?: string | null
}): { from: string; to: string } {
  const today = new Date()
  const to = (input.toParam ?? today.toISOString()).slice(0, 10)

  if (input.fromParam?.trim()) {
    return { from: input.fromParam.trim().slice(0, 10), to }
  }

  if (input.full || input.days <= 0) {
    return { from: "2015-01-01", to }
  }

  const fromDate = new Date(today)
  fromDate.setUTCDate(fromDate.getUTCDate() - input.days)
  return { from: fromDate.toISOString().slice(0, 10), to }
}
