import { createAdminClient, createReadClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { getGradeQuotes, type MockCardEntry, type RecentSale } from "@/lib/slab-data"
import { resolveWatchlistIdForHistory } from "@/lib/db/price-snapshots"

export type DailySalesPoint = {
  soldDate: string
  medianPrice: number
  saleCount: number
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

function aggregateByDay(
  rows: Array<{ sold_date: string; total_price: number }>,
): DailySalesPoint[] {
  const byDate = new Map<string, number[]>()
  for (const row of rows) {
    const prices = byDate.get(row.sold_date) ?? []
    prices.push(Number(row.total_price))
    byDate.set(row.sold_date, prices)
  }

  return [...byDate.entries()]
    .map(([soldDate, prices]) => ({
      soldDate,
      medianPrice: median(prices),
      saleCount: prices.length,
    }))
    .sort((a, b) => a.soldDate.localeCompare(b.soldDate))
}

/** Normalize eBay endedAt / soldDate strings to YYYY-MM-DD (UTC). */
export function parseSoldDate(value: string | undefined | null): string | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function saleDedupeKey(
  watchlistId: string,
  grade: number,
  soldDate: string,
  total: number,
  title: string,
): string {
  const slug = title.trim().slice(0, 120).toLowerCase()
  return `${watchlistId}:${grade}:${soldDate}:${total.toFixed(2)}:${slug}`
}

function saleRowsFromList(
  watchlistId: string,
  grade: number,
  sales: RecentSale[],
): Array<{
  watchlist_id: string
  grade: number
  sold_date: string
  total_price: number
  title: string
  url: string | null
  dedupe_key: string
}> {
  const rows: Array<{
    watchlist_id: string
    grade: number
    sold_date: string
    total_price: number
    title: string
    url: string | null
    dedupe_key: string
  }> = []

  for (const sale of sales) {
    const total = sale.total > 0 ? sale.total : sale.price + sale.shipping
    if (total <= 0) continue
    const soldDate = parseSoldDate(sale.soldDate)
    if (!soldDate) continue
    const title = sale.title?.trim() || "eBay sold comp"
    rows.push({
      watchlist_id: watchlistId,
      grade,
      sold_date: soldDate,
      total_price: total,
      title,
      url: sale.url ?? null,
      dedupe_key: saleDedupeKey(watchlistId, grade, soldDate, total, title),
    })
  }

  return rows
}

/** Persist sold comps from a daily eBay sync for charting. */
export async function appendSaleEventsForCard(
  watchlistId: string,
  rawSales: RecentSale[],
  byGrade: Partial<Record<number, RecentSale[]>>,
): Promise<void> {
  if (!isSupabaseConfigured()) return

  const rows = [
    ...saleRowsFromList(watchlistId, 0, rawSales),
    ...Object.entries(byGrade).flatMap(([gradeKey, sales]) =>
      saleRowsFromList(watchlistId, Number(gradeKey), sales ?? []),
    ),
  ]

  if (rows.length === 0) return

  const supabase = createAdminClient()
  const { error } = await supabase.from("slab_sale_events").upsert(rows, {
    onConflict: "dedupe_key",
    ignoreDuplicates: true,
  })
  if (error) {
    if (error.message.includes("slab_sale_events")) return
    throw new Error(`Failed to upsert sale events: ${error.message}`)
  }
}

/** Batch-append sale events after a full watchlist sync. */
export async function appendSaleEventsFromEntries(entries: MockCardEntry[]): Promise<void> {
  if (!isSupabaseConfigured() || entries.length === 0) return

  const rows: Array<{
    watchlist_id: string
    grade: number
    sold_date: string
    total_price: number
    title: string
    url: string | null
    dedupe_key: string
  }> = []

  for (const entry of entries) {
    if (entry.hasPricing === false) continue
    rows.push(...saleRowsFromList(entry.id, 0, entry.recentRawSales ?? []))
    for (const quote of getGradeQuotes(entry)) {
      if (quote.recentSlabSales?.length) {
        rows.push(...saleRowsFromList(entry.id, quote.grade, quote.recentSlabSales))
      }
    }
  }

  if (rows.length === 0) return

  const supabase = createAdminClient()
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from("slab_sale_events").upsert(chunk, {
      onConflict: "dedupe_key",
      ignoreDuplicates: true,
    })
    if (error) {
      if (error.message.includes("slab_sale_events")) return
      throw new Error(`Failed to upsert sale events: ${error.message}`)
    }
  }
}

export async function getDailySalesForGrade(
  cardOrWatchlistId: string,
  grade: number,
  days = 30,
): Promise<DailySalesPoint[]> {
  if (!isSupabaseConfigured()) return []

  const supabase = createReadClient()
  const watchlistId = await resolveWatchlistIdForHistory(cardOrWatchlistId)
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  const sinceDate = since.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from("slab_sale_events")
    .select("sold_date, total_price")
    .eq("watchlist_id", watchlistId)
    .eq("grade", grade)
    .gte("sold_date", sinceDate)
    .order("sold_date", { ascending: true })

  if (error) {
    if (error.message.includes("slab_sale_events")) return []
    throw new Error(`Failed to read sale events: ${error.message}`)
  }

  return aggregateByDay(data ?? [])
}

export { isSupabaseConfigured }
