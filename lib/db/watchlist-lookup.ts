import watchlistConfig from "@/lib/watchlist-config.json"
import { getWatchlistFromDb } from "@/lib/db/watchlist"
import { resolveWatchlistIdForHistory } from "@/lib/db/price-snapshots"
import { isSupabaseConfigured } from "@/lib/supabase/server"
import type { WatchlistCard } from "@/lib/sync-anomalies"

async function loadWatchlistCards(): Promise<WatchlistCard[]> {
  if (isSupabaseConfigured()) {
    try {
      const fromDb = await getWatchlistFromDb()
      if (fromDb.length > 0) return fromDb
    } catch (error) {
      console.error("[watchlist-lookup] DB watchlist lookup failed:", error)
    }
  }

  return watchlistConfig as WatchlistCard[]
}

/** Resolve a watchlist card for pricing APIs (supports catalog / Pokémon TCG ids). */
export async function findWatchlistCard(
  cardOrWatchlistId: string,
): Promise<WatchlistCard | undefined> {
  const watchlistId = await resolveWatchlistIdForHistory(cardOrWatchlistId)
  const list = await loadWatchlistCards()
  return (
    list.find((c) => c.id === watchlistId) ??
    list.find((c) => c.pokemonTcgId === cardOrWatchlistId) ??
    list.find((c) => c.id === cardOrWatchlistId)
  )
}
