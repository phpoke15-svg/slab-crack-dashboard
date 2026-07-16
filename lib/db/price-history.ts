import { getDeficitHistoryForCard } from "@/lib/db/price-snapshots"
import {
  aggregateRecentSalesByDay,
  appendSaleEventsForCard,
  getDailySalesForGrade,
  type DailySalesPoint,
} from "@/lib/db/sale-events"
import { findWatchlistCard } from "@/lib/db/watchlist-lookup"
import { fetchRecentSalesForCard } from "@/lib/ebay-sold"
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
  /** True when the latest request merged live eBay sold comps. */
  live: boolean
}

function mergeDailySources(
  rawDaily: DailySalesPoint[],
  slabDaily: DailySalesPoint[],
  snapshots: Array<{
    snapshotDate: string
    rawPrice: number
    slabPrice: number
  }>,
  options?: { fillGaps?: boolean },
): Pick<DailyPriceHistoryResult, "points" | "salesDays" | "snapshotDays"> {
  const rawByDate = new Map(rawDaily.map((d) => [d.soldDate, d]))
  const slabByDate = new Map(slabDaily.map((d) => [d.soldDate, d]))
  const snapByDate = new Map(snapshots.map((s) => [s.snapshotDate, s]))

  const allDates = new Set<string>([
    ...rawDaily.map((d) => d.soldDate),
    ...slabDaily.map((d) => d.soldDate),
    ...snapshots.map((s) => s.snapshotDate),
  ])

  let salesDays = 0
  let snapshotDays = 0
  let lastRaw =
    snapshots.find((s) => s.rawPrice > 0)?.rawPrice ?? rawDaily.find((d) => d.medianPrice > 0)?.medianPrice ?? 0
  let lastSlab =
    snapshots.find((s) => s.slabPrice > 0)?.slabPrice ??
    slabDaily.find((d) => d.medianPrice > 0)?.medianPrice ??
    0

  const points: DailyPriceHistoryPoint[] = [...allDates]
    .sort()
    .map((date) => {
      const rawSales = rawByDate.get(date)
      const slabSales = slabByDate.get(date)
      const snap = snapByDate.get(date)

      if (rawSales?.medianPrice) lastRaw = rawSales.medianPrice
      else if (snap?.rawPrice) lastRaw = snap.rawPrice

      if (slabSales?.medianPrice) lastSlab = slabSales.medianPrice
      else if (snap?.slabPrice) lastSlab = snap.slabPrice

      const rawPrice = rawSales?.medianPrice ?? (options?.fillGaps ? lastRaw : snap?.rawPrice ?? 0)
      const slabPrice = slabSales?.medianPrice ?? (options?.fillGaps ? lastSlab : snap?.slabPrice ?? 0)
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

  return { points, salesDays, snapshotDays }
}

function withinDays(date: string, days: number): boolean {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  return date >= since.toISOString().slice(0, 10)
}

async function fetchLiveDailySales(
  cardOrWatchlistId: string,
  grade: PsaGradeNumber,
  days: number,
): Promise<{
  rawDaily: DailySalesPoint[]
  slabDaily: DailySalesPoint[]
  watchlistId: string
} | null> {
  const apiKey = process.env.EBAY_SOLD_API_KEY?.trim()
  if (!apiKey) return null

  const card = await findWatchlistCard(cardOrWatchlistId)
  if (!card) return null

  const { recentRawSales, recentSlabSales } = await fetchRecentSalesForCard(apiKey, card, grade)
  const rawDaily = aggregateRecentSalesByDay(recentRawSales).filter((d) => withinDays(d.soldDate, days))
  const slabDaily = aggregateRecentSalesByDay(recentSlabSales).filter((d) => withinDays(d.soldDate, days))

  void appendSaleEventsForCard(card.id, recentRawSales, { [grade]: recentSlabSales }).catch((error) => {
    console.warn("[price-history] Could not persist live sale events:", error)
  })

  return { rawDaily, slabDaily, watchlistId: card.id }
}

/**
 * Merge daily eBay sold-comp medians with daily sync snapshots.
 * Sales data is preferred per day; snapshots fill gaps.
 * When stored history is thin, fetches live sold comps (same source as Recent Sales).
 */
export async function getDailyPriceHistory(
  cardOrWatchlistId: string,
  grade: PsaGradeNumber,
  days = 30,
): Promise<DailyPriceHistoryResult> {
  const [rawDaily, slabDaily, snapshots] = await Promise.all([
    getDailySalesForGrade(cardOrWatchlistId, 0, days),
    getDailySalesForGrade(cardOrWatchlistId, grade, days),
    getDeficitHistoryForCard(cardOrWatchlistId, grade, days),
  ])

  let merged = mergeDailySources(rawDaily, slabDaily, snapshots)
  let live = false

  if (merged.points.length < 2) {
    try {
      const liveSales = await fetchLiveDailySales(cardOrWatchlistId, grade, days)
      if (liveSales) {
        merged = mergeDailySources(
          [...rawDaily, ...liveSales.rawDaily],
          [...slabDaily, ...liveSales.slabDaily],
          snapshots,
          { fillGaps: true },
        )
        live = merged.points.length >= 2 || liveSales.rawDaily.length > 0 || liveSales.slabDaily.length > 0
      }
    } catch (error) {
      console.warn("[price-history] Live sold-comp fetch failed:", error)
    }
  }

  return { points: merged.points, days, salesDays: merged.salesDays, snapshotDays: merged.snapshotDays, live }
}
