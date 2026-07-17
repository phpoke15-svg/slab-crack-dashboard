import { getDeficitHistoryForCard } from "@/lib/db/price-snapshots"
import { getDailySalesForGrade } from "@/lib/db/sale-events"
import { getPriceHistoryForCard } from "@/lib/pricing/db"
import type { PsaGradeNumber } from "@/lib/slab-data"

export type DailyPriceHistoryPoint = {
  snapshotDate: string
  rawPrice: number
  slabPrice: number
  deficit: number
  rawSaleCount: number
  slabSaleCount: number
  /** True when at least one side came from stored eBay sold comps. */
  fromSales: boolean
}

export type DailyPriceHistoryResult = {
  points: DailyPriceHistoryPoint[]
  days: number
  salesDays: number
  snapshotDays: number
}

/**
 * Merge daily eBay sold-comp medians with daily sync snapshots.
 * Sales data is preferred per day; snapshots fill gaps.
 * Also merges unified price_history when available (card_id keyed).
 */
export async function getDailyPriceHistory(
  cardOrWatchlistId: string,
  grade: PsaGradeNumber,
  days = 30,
): Promise<DailyPriceHistoryResult> {
  const [rawDaily, slabDaily, snapshots, unifiedRaw, unifiedSlab] = await Promise.all([
    getDailySalesForGrade(cardOrWatchlistId, 0, days),
    getDailySalesForGrade(cardOrWatchlistId, grade, days),
    getDeficitHistoryForCard(cardOrWatchlistId, grade, days),
    getPriceHistoryForCard(cardOrWatchlistId, 0, days),
    getPriceHistoryForCard(cardOrWatchlistId, grade, days),
  ])

  const rawByDate = new Map(rawDaily.map((d) => [d.soldDate, d]))
  const slabByDate = new Map(slabDaily.map((d) => [d.soldDate, d]))
  const snapByDate = new Map(snapshots.map((s) => [s.snapshotDate, s]))

  for (const point of unifiedRaw) {
    if (!rawByDate.has(point.snapshotDate)) {
      rawByDate.set(point.snapshotDate, {
        soldDate: point.snapshotDate,
        medianPrice: point.price,
        saleCount: point.saleCount ?? 0,
      })
    }
  }

  for (const point of unifiedSlab) {
    if (!slabByDate.has(point.snapshotDate)) {
      slabByDate.set(point.snapshotDate, {
        soldDate: point.snapshotDate,
        medianPrice: point.price,
        saleCount: point.saleCount ?? 0,
      })
    }
  }

  const allDates = new Set<string>([
    ...rawDaily.map((d) => d.soldDate),
    ...slabDaily.map((d) => d.soldDate),
    ...snapshots.map((s) => s.snapshotDate),
    ...unifiedRaw.map((p) => p.snapshotDate),
    ...unifiedSlab.map((p) => p.snapshotDate),
  ])

  let salesDays = 0
  let snapshotDays = 0

  const points: DailyPriceHistoryPoint[] = [...allDates]
    .sort()
    .map((date) => {
      const rawSales = rawByDate.get(date)
      const slabSales = slabByDate.get(date)
      const snap = snapByDate.get(date)

      const rawPrice = rawSales?.medianPrice ?? snap?.rawPrice ?? 0
      const slabPrice = slabSales?.medianPrice ?? snap?.slabPrice ?? 0
      const fromSales = Boolean(rawSales || slabSales)

      if (fromSales) salesDays += 1
      else if (snap) snapshotDays += 1

      return {
        snapshotDate: date,
        rawPrice,
        slabPrice,
        deficit: rawPrice - slabPrice,
        rawSaleCount: rawSales?.saleCount ?? 0,
        slabSaleCount: slabSales?.saleCount ?? 0,
        fromSales,
      }
    })
    .filter((p) => p.rawPrice > 0 && p.slabPrice > 0)

  return { points, days, salesDays, snapshotDays }
}
