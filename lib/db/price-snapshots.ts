import { createAdminClient, createReadClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  getGradeQuotes,
  isPsaSlabGrade,
  type MockCardEntry,
  type PsaGradeNumber,
} from "@/lib/slab-data"

export type PriceSnapshotPoint = {
  deficit: number
  rawPrice: number
  slabPrice: number
  capturedAt: string
  snapshotDate: string
}

/**
 * Upsert one daily snapshot per watchlist card × grade that has a slab price.
 * Deficit = raw − slab (positive = arbitrage gap).
 */
export async function appendPriceSnapshots(entries: MockCardEntry[]): Promise<void> {
  if (!isSupabaseConfigured() || entries.length === 0) return

  const supabase = createAdminClient()
  const snapshotDate = new Date().toISOString().slice(0, 10)
  const capturedAt = new Date().toISOString()
  const rows: Array<{
    watchlist_id: string
    grade: number
    raw_price: number
    slab_price: number
    deficit: number
    snapshot_date: string
    captured_at: string
  }> = []

  for (const entry of entries) {
    if (entry.hasPricing === false || entry.rawPrice <= 0) continue
    const quotes = getGradeQuotes(entry)
    for (const quote of quotes) {
      if (!isPsaSlabGrade(quote.grade) || quote.slabPrice <= 0) continue
      rows.push({
        watchlist_id: entry.id,
        grade: quote.grade,
        raw_price: entry.rawPrice,
        slab_price: quote.slabPrice,
        deficit: entry.rawPrice - quote.slabPrice,
        snapshot_date: snapshotDate,
        captured_at: capturedAt,
      })
    }
  }

  if (rows.length === 0) return

  const { error } = await supabase.from("slab_price_snapshots").upsert(rows, {
    onConflict: "watchlist_id,grade,snapshot_date",
  })
  if (error) {
    // Table may not exist until SQL migration is run — surface clearly.
    throw new Error(`Failed to upsert price snapshots: ${error.message}`)
  }
}

export async function getDeficitHistoryForCard(
  watchlistId: string,
  grade: PsaGradeNumber,
  days = 30,
): Promise<PriceSnapshotPoint[]> {
  if (!isSupabaseConfigured()) return []

  const supabase = createReadClient()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  const sinceDate = since.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from("slab_price_snapshots")
    .select("deficit, raw_price, slab_price, captured_at, snapshot_date")
    .eq("watchlist_id", watchlistId)
    .eq("grade", grade)
    .gte("snapshot_date", sinceDate)
    .order("snapshot_date", { ascending: true })

  if (error) {
    if (error.message.includes("slab_price_snapshots")) return []
    throw new Error(`Failed to read price snapshots: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    deficit: Number(row.deficit),
    rawPrice: Number(row.raw_price),
    slabPrice: Number(row.slab_price),
    capturedAt: String(row.captured_at),
    snapshotDate: String(row.snapshot_date),
  }))
}

export { isSupabaseConfigured }
