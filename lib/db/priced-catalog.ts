import mockData from "@/lib/mockData.json"
import { getFeaturedCatalogCards } from "@/lib/db/cards-catalog"
import { getBinderCardPriceById, getBinderCardPricesForIds } from "@/lib/db/binder-card-prices"
import { getCardPricesForIds, getRawPriceMapFromCardPrices } from "@/lib/pricing/db"
import { mergeCachedRawPrices } from "@/lib/pricing/views"
import { getScrydexRawPricesForIds } from "@/lib/scrydex/price-adapter"
import { expandCardIdList } from "@/lib/trade-binder/card-id-match"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { cache } from "react"
import {
  type PricedCatalogCard,
  type PricedCatalogSource,
  sortPricedCatalog,
  toBinderCatalogCard,
  toPricedCatalogCard,
} from "@/lib/trade-binder/priced-catalog"
import type { MockCardEntry } from "@/lib/slab-data"

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

async function allRowsFromDb(): Promise<PricedCatalogCard[]> {
  const hits = await getFeaturedCatalogCards(500)
  const sources: PricedCatalogSource[] = hits.map((hit) => ({
    id: hit.id,
    name: hit.name,
    setName: hit.setName,
    cardNumber: hit.number,
    rarity: hit.rarity,
    imageUrl: hit.imageUrl,
    rawPrice: hit.rawPrice ?? 0,
  }))

  return sourcesToCatalog(sources, { requirePrice: false })
}
async function getRawPriceByCardIdUncached(): Promise<Map<string, number>> {
  const [unifiedPrices, binderPrices] = await Promise.all([
    getRawPriceMapFromCardPrices(),
    getBinderCardPriceById(),
  ])

  const priceByCardId = mergeCachedRawPrices(unifiedPrices, binderPrices)

  if (!isSupabaseConfigured()) return priceByCardId

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
    return priceByCardId
  }
}

export const getRawPriceByCardId = cache(getRawPriceByCardIdUncached)

/** Targeted price lookup for a page of card IDs (avoids full-table scans). */
export async function getRawPricesForCardIds(cardIds: string[]): Promise<Map<string, number>> {
  const uniqueIds = [...new Set(cardIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const expandedIds = expandCardIdList(uniqueIds)
  const [priceRows, binderPrices, scrydexPrices] = await Promise.all([
    getCardPricesForIds(expandedIds),
    getBinderCardPricesForIds(expandedIds),
    getScrydexRawPricesForIds(uniqueIds),
  ])

  const merged = new Map<string, number>()
  for (const [cardId, price] of scrydexPrices) {
    if (price > 0) merged.set(cardId, price)
  }

  for (const [cardId, row] of priceRows) {
    if ((row.raw_price ?? 0) > 0 && !merged.has(cardId)) merged.set(cardId, row.raw_price!)
  }

  mergeCachedRawPrices(merged, binderPrices)
  const result = new Map<string, number>()
  for (const id of uniqueIds) {
    for (const variant of expandCardIdList([id])) {
      const price = merged.get(variant)
      if (price && price > 0) {
        result.set(id, price)
        break
      }
    }
  }
  return result
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
