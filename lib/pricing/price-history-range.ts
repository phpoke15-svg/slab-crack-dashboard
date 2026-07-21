export const PRICE_HISTORY_RANGE_PRESETS = {
  "7": 7,
  "30": 30,
  "90": 90,
  "180": 180,
  "365": 365,
  all: 0,
} as const

export type PriceHistoryRangeKey = keyof typeof PRICE_HISTORY_RANGE_PRESETS

export const PRICE_HISTORY_RANGE_OPTIONS: Array<{ key: PriceHistoryRangeKey; label: string }> = [
  { key: "7", label: "7D" },
  { key: "30", label: "30D" },
  { key: "90", label: "90D" },
  { key: "180", label: "6M" },
  { key: "365", label: "1Y" },
  { key: "all", label: "All" },
]

export const DEFAULT_PRICE_HISTORY_RANGE: PriceHistoryRangeKey = "30"

export function parsePriceHistoryRange(value: string | null | undefined): {
  key: PriceHistoryRangeKey
  days: number
  full: boolean
} {
  const normalized = (value ?? DEFAULT_PRICE_HISTORY_RANGE).trim().toLowerCase()

  if (normalized === "all" || normalized === "0") {
    return { key: "all", days: 0, full: true }
  }

  if (normalized in PRICE_HISTORY_RANGE_PRESETS) {
    const key = normalized as PriceHistoryRangeKey
    const days = PRICE_HISTORY_RANGE_PRESETS[key]
    return { key, days, full: days === 0 }
  }

  const numericDays = Number(normalized)
  if (Number.isFinite(numericDays) && numericDays > 0) {
    return { key: DEFAULT_PRICE_HISTORY_RANGE, days: Math.min(Math.round(numericDays), 3650), full: false }
  }

  return {
    key: DEFAULT_PRICE_HISTORY_RANGE,
    days: PRICE_HISTORY_RANGE_PRESETS[DEFAULT_PRICE_HISTORY_RANGE],
    full: false,
  }
}

export function priceHistoryRangeFromDays(days: number): PriceHistoryRangeKey {
  if (days <= 0 || days >= 9999) return "all"
  if (days >= 365) return "365"
  if (days >= 180) return "180"
  if (days >= 90) return "90"
  if (days >= 30) return "30"
  if (days >= 7) return "7"
  return DEFAULT_PRICE_HISTORY_RANGE
}
