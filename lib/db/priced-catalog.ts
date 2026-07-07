import mockData from "@/lib/mockData.json"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  type PricedCatalogCard,
  type PricedCatalogSource,
  sortPricedCatalog,
  toBinderCatalogCard,
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

function sourcesToCatalog(
  sources: PricedCatalogSource[],
  options?: { requirePrice?: boolean },
): PricedCatalogCard[] {
  const requirePrice = options?.requirePrice ?? true
  const toCard = requirePrice ? toPricedCatalogCard : toBinderCatalogCard
  const byId = new Map<string, PricedCatalogCard>()
  for (const source of sources) {
    const card = toCard(source)
    if (card) mergePricedCard(byId, card)
  }
  return sortPricedCatalog([...byId.values()])
}

async function fetchAllSlabCards(): Promise<SlabCardRow[]> {
  const supabase = createAdminClient()
  const pageSize = 1000
  let from = 0
  const all: SlabCardRow[] = []

  while (true) {
    const { data, error } = await supabase
      .from("slab_cards")
      .select(
        "id, name, set_name, card_number, rarity, image_large, image_small, release_date",
      )
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data?.length) break

    all.push(...(data as SlabCardRow[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  return all
}

export async function getRawPriceByCardId(): Promise<Map<string, number>> {
  if (!isSupabaseConfigured()) return new Map()

  try {
    const supabase = createAdminClient()
    const [{ data: watchlistRows, error: watchlistError }, { data: anomalyRows, error: anomalyError }] =
      await Promise.all([
        supabase.from("slab_watchlist_cards").select("id, card_id"),
        supabase.from("slab_anomalies").select("watchlist_id, raw_price").gt("raw_price", 0),
      ])

    if (watchlistError) throw watchlistError
    if (anomalyError) throw anomalyError

    const rawByWatchlist = new Map(
      ((anomalyRows ?? []) as AnomalyRow[]).map((row) => [row.watchlist_id, Number(row.raw_price)]),
    )

    const priceByCardId = new Map<string, number>()
    for (const row of (watchlistRows ?? []) as { id: string; card_id: string | null }[]) {
      const rawPrice = rawByWatchlist.get(row.id)
      if (!rawPrice || !row.card_id) continue
      const existing = priceByCardId.get(row.card_id)
      if (!existing || rawPrice > existing) {
        priceByCardId.set(row.card_id, rawPrice)
      }
    }

    return priceByCardId
  } catch (error) {
    console.error("[priced-catalog] raw price map failed:", error)
    return new Map()
  }
}

async function allRowsFromDb(): Promise<PricedCatalogCard[]> {
  const [slabCards, priceByCardId] = await Promise.all([fetchAllSlabCards(), getRawPriceByCardId()])

  const sources: PricedCatalogSource[] = slabCards.map((card) => ({
    id: card.id,
    name: card.name,
    setName: card.set_name,
    cardNumber: card.card_number,
    rarity: card.rarity,
    imageUrl: card.image_large ?? card.image_small,
    rawPrice: priceByCardId.get(card.id) ?? 0,
  }))

  return sourcesToCatalog(sources, { requirePrice: false })
}

function pricedRowsFromMock(): PricedCatalogCard[] {
  const sources: PricedCatalogSource[] = []
  for (const entry of mockData as MockCardEntry[]) {
    const source = mockEntryToSource(entry)
    if (source) sources.push(source)
  }
  return sourcesToCatalog(sources)
}

export async function getPricedCatalogCards(): Promise<PricedCatalogCard[]> {
  if (!isSupabaseConfigured()) {
    return pricedRowsFromMock()
  }

  try {
    const fromDb = await allRowsFromDb()
    if (fromDb.length > 0) return fromDb
  } catch (error) {
    console.error("[priced-catalog] Supabase read failed, using mock fallback:", error)
  }

  return pricedRowsFromMock()
}

export { isSupabaseConfigured }
