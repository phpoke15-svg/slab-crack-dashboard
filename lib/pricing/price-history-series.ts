import { getPriceHistoryForCard } from "@/lib/pricing/db"
import type {
  PriceHistoryPoint,
  PriceHistorySeriesKey,
  PriceHistorySeriesMap,
  PriceHistorySeriesPoint,
} from "@/lib/pricing/types"

export type { PriceHistorySeriesKey, PriceHistorySeriesMap, PriceHistorySeriesPoint }

const SERIES_GRADES: Array<{ key: PriceHistorySeriesKey; grade: number; label: string }> = [
  { key: "raw", grade: 0, label: "TCGPlayer Raw" },
  { key: "psa7", grade: 7, label: "eBay PSA 7" },
  { key: "psa8", grade: 8, label: "eBay PSA 8" },
  { key: "psa9", grade: 9, label: "eBay PSA 9" },
  { key: "psa10", grade: 10, label: "eBay PSA 10" },
]

export function priceHistorySeriesLabels(): Record<PriceHistorySeriesKey, string> {
  return Object.fromEntries(SERIES_GRADES.map((s) => [s.key, s.label])) as Record<
    PriceHistorySeriesKey,
    string
  >
}

function toSeriesPoint(point: PriceHistoryPoint): PriceHistorySeriesPoint {
  return {
    date: point.snapshotDate,
    price: point.price,
    saleCount: point.saleCount,
    source: point.source,
  }
}

/** Group stored price_history rows into chart series. days <= 0 = all stored points. */
export async function getPriceHistorySeriesMap(
  cardId: string,
  days = 30,
): Promise<{ series: PriceHistorySeriesMap; range: { from: string | null; to: string | null } }> {
  const byGrade = await Promise.all(
    SERIES_GRADES.map(async ({ key, grade }) => {
      const points = await getPriceHistoryForCard(cardId, grade, days)
      return [key, points.map(toSeriesPoint)] as const
    }),
  )

  const series = Object.fromEntries(byGrade) as PriceHistorySeriesMap
  const allDates = byGrade.flatMap(([, points]) => points.map((p) => p.date)).sort()

  return {
    series,
    range: {
      from: allDates[0] ?? null,
      to: allDates[allDates.length - 1] ?? null,
    },
  }
}

export { SERIES_GRADES }
