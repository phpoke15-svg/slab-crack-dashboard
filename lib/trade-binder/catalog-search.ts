import {
  catalogHitToBinderCard,
  searchCatalogCardsLocal,
  type CatalogSearchHit,
} from "@/lib/db/cards-catalog"
import { catalogSearchMinLength } from "@/lib/db/catalog-search-local"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { hasTcgGoApiKey } from "@/lib/pricing/provider"
import { mergeBinderSearchResults } from "@/lib/trade-binder/binder-search"
import {
  pokemonApiToBinderCard,
  searchPokemonCatalog,
  type PricedCatalogCard,
} from "@/lib/trade-binder/pokemon-catalog"
import type { CatalogCard } from "@/lib/trade-binder/cards"

export type BinderCatalogCard = CatalogCard & { rawPrice?: number; cardNumber?: string }
export type CatalogSearchSource = "local" | "tcggo" | "hybrid"

const LIVE_FALLBACK_THRESHOLD = 8

function pricedCardToCatalogHit(card: PricedCatalogCard): CatalogSearchHit {
  return {
    id: card.id,
    name: card.name,
    setName: card.set,
    setId: "",
    number: card.cardNumber ?? "",
    rarity: card.rarity,
    imageUrl: card.image,
    language: "en",
    japaneseName: null,
    rawPrice: card.rawPrice,
  }
}

function binderCardFromPriced(card: PricedCatalogCard): BinderCatalogCard {
  return {
    id: card.id,
    name: card.name,
    set: card.set,
    rarity: card.rarity,
    image: upgradeCardImageUrlSync(card.image),
    cardNumber: card.cardNumber,
    rawPrice: card.rawPrice,
  }
}

function shouldFetchLiveCatalog(query: string, localCount: number, limit: number): boolean {
  if (!hasTcgGoApiKey()) return false
  if (localCount === 0) return true
  if (localCount < Math.min(LIVE_FALLBACK_THRESHOLD, limit)) {
    const tokenCount = query.trim().split(/\s+/).filter(Boolean).length
    return tokenCount >= 2
  }
  return false
}

async function fetchLiveCatalogHits(query: string, limit: number): Promise<CatalogSearchHit[]> {
  const { cards } = await searchPokemonCatalog(query, limit)
  const hits: CatalogSearchHit[] = []

  for (const apiCard of cards) {
    const priced = pokemonApiToBinderCard(apiCard)
    if (!priced) continue
    hits.push(pricedCardToCatalogHit(priced))
    if (hits.length >= limit) break
  }

  return hits
}

function mergeCatalogHits(
  localHits: CatalogSearchHit[],
  liveHits: CatalogSearchHit[],
  query: string,
  limit: number,
): { hits: CatalogSearchHit[]; source: CatalogSearchSource } {
  if (liveHits.length === 0) {
    return { hits: localHits.slice(0, limit), source: "local" }
  }
  if (localHits.length === 0) {
    return { hits: liveHits.slice(0, limit), source: "tcggo" }
  }

  const merged = mergeBinderSearchResults(
    [...localHits, ...liveHits].map((hit) => {
      const card = catalogHitToBinderCard(hit)
      return {
        id: card.id,
        name: card.name,
        set: card.set,
        rarity: card.rarity ?? "Common",
        image: card.image,
        cardNumber: card.cardNumber,
        rawPrice: card.rawPrice,
      }
    }),
    query,
  )

  const byId = new Map<string, CatalogSearchHit>()
  for (const hit of [...localHits, ...liveHits]) {
    if (!byId.has(hit.id)) byId.set(hit.id, hit)
  }

  const hits = merged
    .map((card) => byId.get(card.id))
    .filter((hit): hit is CatalogSearchHit => hit != null)
    .slice(0, limit)

  return { hits, source: "hybrid" }
}

export async function searchCatalogHybrid(
  query: string,
  options?: { limit?: number; rawPriceByCardId?: Map<string, number> },
): Promise<{ hits: CatalogSearchHit[]; source: CatalogSearchSource }> {
  const limit = options?.limit ?? 40
  const rawPriceByCardId = options?.rawPriceByCardId ?? new Map<string, number>()

  if (!catalogSearchMinLength(query)) {
    return { hits: [], source: "local" }
  }

  const localHits = await searchCatalogCardsLocal(query, Math.min(limit * 2, 80))
  let liveHits: CatalogSearchHit[] = []

  if (shouldFetchLiveCatalog(query, localHits.length, limit)) {
    try {
      liveHits = await fetchLiveCatalogHits(query, limit)
    } catch (error) {
      console.warn("[catalog-search] live TCGGO fallback failed:", error)
    }
  }

  const { hits, source } = mergeCatalogHits(localHits, liveHits, query, limit)

  const enriched = hits.map((hit) => {
    if ((hit.rawPrice ?? 0) > 0) return hit
    const cached =
      rawPriceByCardId.get(hit.id) ?? rawPriceByCardId.get(hit.id.replace(/^poke-/, ""))
    if (cached && cached > 0) return { ...hit, rawPrice: cached }
    return hit
  })

  return { hits: enriched, source }
}

export async function searchBinderCatalog(
  query: string,
  options?: { limit?: number; rawPriceByCardId?: Map<string, number> },
): Promise<BinderCatalogCard[]> {
  const { hits } = await searchCatalogHybrid(query, options)
  return hits.map((hit) => {
    const card = catalogHitToBinderCard(hit)
    const image = upgradeCardImageUrlSync(card.image)
    return image !== card.image ? { ...card, image } : card
  })
}

export async function searchBinderCatalogWithSource(
  query: string,
  options?: { limit?: number; rawPriceByCardId?: Map<string, number> },
): Promise<{ cards: BinderCatalogCard[]; source: CatalogSearchSource }> {
  const { hits, source } = await searchCatalogHybrid(query, options)
  const cards = hits.map((hit) => binderCardFromPriced({
    id: hit.id,
    name: hit.name,
    set: hit.setName,
    rarity: hit.rarity ?? "Common",
    image: hit.imageUrl,
    cardNumber: hit.number || undefined,
    rawPrice: hit.rawPrice ?? 0,
  }))
  return { cards, source }
}
