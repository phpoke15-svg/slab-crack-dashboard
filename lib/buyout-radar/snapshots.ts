import "server-only"

import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { MarketSnapshotRow } from "@/lib/buyout-radar/stealth-detect"

type DbSnapshotRow = {
  card_id: string
  scanned_at: string
  daily_volume: number
  unique_listings: number | null
  market_price: number
  listings_source: string
}

function mapRow(row: DbSnapshotRow): MarketSnapshotRow {
  return {
    cardId: row.card_id,
    scannedAt: row.scanned_at,
    dailyVolume: Number(row.daily_volume),
    uniqueListings: row.unique_listings == null ? null : Number(row.unique_listings),
    marketPrice: Number(row.market_price),
    listingsSource:
      row.listings_source === "ebay-browse" ||
      row.listings_source === "comp-proxy" ||
      row.listings_source === "seed"
        ? row.listings_source
        : "unknown",
  }
}

export async function upsertMarketSnapshot(snapshot: MarketSnapshotRow): Promise<void> {
  if (!isSupabaseConfigured()) return
  const admin = createAdminClient()
  const scannedDay = snapshot.scannedAt.slice(0, 10)

  await admin
    .from("buyout_market_snapshots")
    .delete()
    .eq("card_id", snapshot.cardId)
    .gte("scanned_at", `${scannedDay}T00:00:00.000Z`)
    .lte("scanned_at", `${scannedDay}T23:59:59.999Z`)

  const { error } = await admin.from("buyout_market_snapshots").insert({
    card_id: snapshot.cardId,
    scanned_at: snapshot.scannedAt,
    daily_volume: snapshot.dailyVolume,
    unique_listings: snapshot.uniqueListings,
    market_price: snapshot.marketPrice,
    listings_source: snapshot.listingsSource,
  })
  if (error) {
    console.warn("[buyout-snapshots] insert failed:", error.message)
  }
}

export async function loadMarketSnapshots(
  sinceDays = 20,
): Promise<MarketSnapshotRow[]> {
  if (!isSupabaseConfigured()) return []
  const admin = createAdminClient()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - sinceDays)

  const rows: MarketSnapshotRow[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("buyout_market_snapshots")
      .select(
        "card_id, scanned_at, daily_volume, unique_listings, market_price, listings_source",
      )
      .gte("scanned_at", since.toISOString())
      .order("scanned_at", { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) {
      console.warn("[buyout-snapshots] load failed:", error.message)
      break
    }
    const batch = (data ?? []) as DbSnapshotRow[]
    if (batch.length === 0) break
    rows.push(...batch.map(mapRow))
    if (batch.length < pageSize) break
  }
  return rows
}

export async function insertSeedSnapshots(rows: MarketSnapshotRow[]): Promise<void> {
  if (!isSupabaseConfigured() || rows.length === 0) return
  const admin = createAdminClient()
  const { error } = await admin.from("buyout_market_snapshots").insert(
    rows.map((row) => ({
      card_id: row.cardId,
      scanned_at: row.scannedAt,
      daily_volume: row.dailyVolume,
      unique_listings: row.uniqueListings,
      market_price: row.marketPrice,
      listings_source: row.listingsSource,
    })),
  )
  if (error) {
    console.warn("[buyout-snapshots] seed insert failed:", error.message)
  }
}
