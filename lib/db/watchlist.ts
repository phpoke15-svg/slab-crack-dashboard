import { createAdminClient, createReadClient } from "@/lib/supabase/server"
import type { WatchlistCard } from "@/lib/sync-anomalies"

type WatchlistRow = {
  id: string
  pricecharting_id: string | null
  search_query: string | null
  ebay_queries: WatchlistCard["ebayQueries"] | null
  market_insight: string
  slab_cards: {
    id: string
    name: string
    set_name: string
    card_number: string
    image_large: string | null
    rarity: string | null
  } | null
}

function formatDisplayName(name: string, rarity: string | null): string {
  if (!rarity) return name
  if (name.toLowerCase().includes(rarity.toLowerCase())) return name
  return `${name} (${rarity})`
}

export async function getWatchlistFromDb(): Promise<WatchlistCard[]> {
  const supabase = createReadClient()

  const { data, error } = await supabase
    .from("slab_watchlist_cards")
    .select(
      `
      id,
      pricecharting_id,
      search_query,
      ebay_queries,
      market_insight,
      slab_cards (
        id,
        name,
        set_name,
        card_number,
        image_large,
        rarity
      )
    `,
    )

  if (error) throw new Error(`Failed to load watchlist: ${error.message}`)

  return ((data ?? []) as WatchlistRow[])
    .filter((row) => row.slab_cards)
    .map((row) => {
      const card = row.slab_cards!
      return {
        id: row.id,
        pokemonTcgId: card.id,
        priceChartingId: row.pricecharting_id ?? undefined,
        searchQuery: row.search_query ?? undefined,
        ebayQueries: row.ebay_queries ?? undefined,
        cardName: formatDisplayName(card.name, card.rarity),
        setName: card.set_name,
        cardNumber: card.card_number,
        imageUrl: card.image_large ?? "https://placehold.co/150x210",
        marketInsight: row.market_insight,
      }
    })
}

export async function getWatchlistCount(): Promise<number> {
  const supabase = createReadClient()
  const { count, error } = await supabase
    .from("slab_watchlist_cards")
    .select("*", { count: "exact", head: true })

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function updatePriceChartingId(
  watchlistId: string,
  pricechartingId: string,
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("slab_watchlist_cards")
    .update({ pricecharting_id: pricechartingId })
    .eq("id", watchlistId)

  if (error) throw new Error(`Failed to update PriceCharting id: ${error.message}`)
}
