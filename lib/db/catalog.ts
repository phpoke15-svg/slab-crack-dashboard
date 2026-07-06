import watchlistConfig from "@/lib/watchlist-config.json"
import { buildPokemonSearchQueries, fetchPokemonCardForWatchlist, type CatalogCard } from "@/lib/pokemon-tcg"
import { createAdminClient } from "@/lib/supabase/server"
import type { WatchlistCard } from "@/lib/sync-anomalies"

export async function upsertCatalogCard(card: CatalogCard): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from("slab_cards").upsert({
    id: card.id,
    name: card.name,
    set_name: card.setName,
    card_number: card.cardNumber,
    rarity: card.rarity,
    image_small: card.imageSmall,
    image_large: card.imageLarge,
    updated_at: new Date().toISOString(),
  })

  if (error) throw new Error(`Failed to upsert card ${card.id}: ${error.message}`)
}

export async function upsertWatchlistCard(entry: WatchlistCard, cardId: string | null): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from("slab_watchlist_cards").upsert({
    id: entry.id,
    card_id: cardId,
    pricecharting_id: entry.priceChartingId || null,
    search_query: entry.searchQuery ?? null,
    ebay_queries: entry.ebayQueries ?? null,
    market_insight: entry.marketInsight,
  })

  if (error) throw new Error(`Failed to upsert watchlist ${entry.id}: ${error.message}`)
}

export interface SeedResult {
  watchlistId: string
  cardId: string | null
  cardName: string
  imageUrl: string | null
  status: "seeded" | "not_found"
}

export async function seedCatalogFromWatchlist(): Promise<SeedResult[]> {
  const watchlist = watchlistConfig as WatchlistCard[]
  const results: SeedResult[] = []

  for (const entry of watchlist) {
    let catalog: CatalogCard | null = null
    try {
      catalog = await fetchPokemonCardForWatchlist({
        cardName: entry.cardName,
        setName: entry.setName,
        cardNumber: entry.cardNumber,
        pokemonTcgId: entry.pokemonTcgId,
      })
    } catch (error) {
      console.error(`[seed] Pokémon TCG lookup failed for ${entry.id}:`, error)
    }

    if (catalog) {
      await upsertCatalogCard(catalog)
      await upsertWatchlistCard(entry, catalog.id)
      results.push({
        watchlistId: entry.id,
        cardId: catalog.id,
        cardName: catalog.name,
        imageUrl: catalog.imageLarge,
        status: "seeded",
      })
    } else {
      await upsertWatchlistCard(entry, null)
      results.push({
        watchlistId: entry.id,
        cardId: null,
        cardName: entry.cardName,
        imageUrl: null,
        status: "not_found",
      })
    }

    await new Promise((r) => setTimeout(r, 300))
  }

  return results
}
