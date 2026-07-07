import mockData from "@/lib/mockData.json"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  type PricedCatalogCard,
  type PricedCatalogSource,
  sortPricedCatalog,
  toPricedCatalogCard,
} from "@/lib/trade-binder/priced-catalog"
import type { MockCardEntry } from "@/lib/slab-data"

type SlabCardRow = {
  id: string
  name: string
  set_name: string
  card_number: string
  rarity: string | null
  image_large: string | null
  image_small: string | null
  release_date: string | null
}

type WatchlistRow = {
  id: string
  slab_cards: SlabCardRow | null
}

type AnomalyRow = {
  watchlist_id: string
  raw_price: number
}

function mockEntryToSource(entry: MockCardEntry): PricedCatalogSource | null {
  if (entry.rawPrice <= 0 || entry.hasPricing === false) return null
  return {
    id: entry.id,
    name: entry.cardName.replace(/\s+\([^)]+\)$/, ""),
    setName: entry.setName,
    cardNumber: entry.cardNumber,
    rarity: entry.cardName.match(/\(([^)]+)\)$/)?.[1] ?? null,
    imageUrl: entry.imageUrl,
    rawPrice: entry.rawPrice,
  }
}

function mergePricedCard(
  byId: Map<string, PricedCatalogCard>,
  card: PricedCatalogCard,
) {
  const existing = byId.get(card.id)
  if (!existing || card.rawPrice > existing.rawPrice) {
    byId.set(card.id, card)
  }
}

function sourcesToCatalog(sources: PricedCatalogSource[]): PricedCatalogCard[] {
  const byId = new Map<string, PricedCatalogCard>()
  for (const source of sources) {
    const card = toPricedCatalogCard(source)
    if (card) mergePricedCard(byId, card)
  }
  return sortPricedCatalog([...byId.values()])
}

function pricedRowsFromMock(): PricedCatalogCard[] {
  const sources: PricedCatalogSource[] = []
  for (const entry of mockData as MockCardEntry[]) {
    const source = mockEntryToSource(entry)
    if (source) sources.push(source)
  }
  return sourcesToCatalog(sources)
}

async function pricedRowsFromDb(): Promise<PricedCatalogCard[]> {
  const supabase = createAdminClient()

  const [{ data: watchlistRows, error: watchlistError }, { data: anomalyRows, error: anomalyError }] =
    await Promise.all([
      supabase.from("slab_watchlist_cards").select(
        `
        id,
        slab_cards (
          id,
          name,
          set_name,
          card_number,
          rarity,
          image_large,
          image_small,
          release_date
        )
      `,
      ),
      supabase.from("slab_anomalies").select("watchlist_id, raw_price").gt("raw_price", 0),
    ])

  if (watchlistError) throw watchlistError
  if (anomalyError) throw anomalyError

  const rawByWatchlist = new Map(
    ((anomalyRows ?? []) as AnomalyRow[]).map((row) => [row.watchlist_id, Number(row.raw_price)]),
  )

  const sources: PricedCatalogSource[] = []

  for (const row of (watchlistRows ?? []) as WatchlistRow[]) {
    const rawPrice = rawByWatchlist.get(row.id)
    if (!rawPrice || rawPrice <= 0) continue

    const card = row.slab_cards
    if (!card) continue

    sources.push({
      id: card.id,
      name: card.name,
      setName: card.set_name,
      cardNumber: card.card_number,
      rarity: card.rarity,
      imageUrl: card.image_large ?? card.image_small,
      rawPrice,
    })
  }

  return sourcesToCatalog(sources)
}

export async function getPricedCatalogCards(): Promise<PricedCatalogCard[]> {
  if (!isSupabaseConfigured()) {
    return pricedRowsFromMock()
  }

  try {
    const fromDb = await pricedRowsFromDb()
    if (fromDb.length > 0) return fromDb
  } catch (error) {
    console.error("[priced-catalog] Supabase read failed, using mock fallback:", error)
  }

  return pricedRowsFromMock()
}

export { isSupabaseConfigured }
