import {
  catalogHitToBinderCard,
  searchCatalogCardsLocal,
  upsertCatalogCards,
  type CatalogSearchHit,
} from "@/lib/db/cards-catalog"
import { catalogPokemonTcgId } from "@/lib/db/cards-catalog"
import { catalogSearchMinLength } from "@/lib/db/catalog-search-local"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { hasTcgGoApiKey } from "@/lib/pricing/provider"
import { mergeBinderSearchResults } from "@/lib/trade-binder/binder-search"
import { searchTcgGoBinderCards, type PricedCatalogCard } from "@/lib/trade-binder/pokemon-catalog"
import { searchSupplementalCatalog } from "@/lib/trade-binder/supplemental-catalog"
import { parseBinderSearchTokens, resolveBinderSetIdHint, cardNumberMatches } from "@/lib/trade-binder/pokemon-tcg"
import type { CatalogCard } from "@/lib/trade-binder/cards"

export type BinderCatalogCard = CatalogCard & { rawPrice?: number; cardNumber?: string }
export type CatalogSearchSource = "local" | "tcggo" | "hybrid" | "supplemental"

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

function localResultsMatchSetHint(
  hits: CatalogSearchHit[],
  setHint: string,
  number?: string,
): boolean {
  if (hits.length === 0) return false
  const top = hits.slice(0, 5)
  return top.some((hit) => {
    const setCompact = hit.setName.toLowerCase().replace(/[^a-z0-9]/g, "")
    const resolved = resolveBinderSetIdHint(setHint)?.toLowerCase() ?? setHint.toLowerCase()
    const idLower = hit.id.toLowerCase()
    const setMatches =
      setCompact.includes(resolved) || idLower.includes(resolved) || idLower.includes(setHint.toLowerCase())
    if (!number) return setMatches
    const numberMatches = hit.number.split("/")[0]?.replace(/^#/, "") === number.replace(/^#/, "")
    return setMatches && numberMatches
  })
}

function localResultsMatchNameAndNumber(
  hits: CatalogSearchHit[],
  name: string,
  number: string,
): boolean {
  const normalizedName = name.toLowerCase().trim()
  return hits.some((hit) => {
    if (!cardNumberMatches(hit.number, number)) return false
    return hit.name.toLowerCase().includes(normalizedName)
  })
}

function shouldFetchLiveCatalog(
  query: string,
  localHits: CatalogSearchHit[],
  limit: number,
): boolean {
  if (!hasTcgGoApiKey()) return false

  const tokens = parseBinderSearchTokens(query)
  if (tokens.name && tokens.number && localResultsMatchNameAndNumber(localHits, tokens.name, tokens.number)) {
    return false
  }
  if (tokens.name && tokens.number && !localResultsMatchNameAndNumber(localHits, tokens.name, tokens.number)) {
    return true
  }
  if (tokens.setHint && tokens.number && localResultsMatchSetHint(localHits, tokens.setHint, tokens.number)) {
    return false
  }
  if (tokens.setHint && tokens.number && !localResultsMatchSetHint(localHits, tokens.setHint, tokens.number)) {
    return true
  }

  const localCount = localHits.length
  if (localCount === 0) return true
  if (localCount < Math.min(LIVE_FALLBACK_THRESHOLD, limit)) {
    const tokenCount = query.trim().split(/\s+/).filter(Boolean).length
    return tokenCount >= 2
  }
  return false
}

async function persistLiveCatalogHits(hits: CatalogSearchHit[]): Promise<void> {
  if (hits.length === 0 || !process.env.SUPABASE_SERVICE_ROLE_KEY) return

  const rows = hits.map((hit) => {
    const tcgId = catalogPokemonTcgId(hit.id)
    const setId = hit.setId || tcgId.split("-")[0] || "unknown"
    return {
      id: hit.id,
      name: hit.name,
      set_name: hit.setName,
      set_id: setId,
      number: hit.number,
      rarity: hit.rarity,
      image_url: hit.imageUrl,
      language: hit.language,
    }
  })

  await upsertCatalogCards(rows)
}

async function fetchLiveCatalogHits(query: string, limit: number): Promise<CatalogSearchHit[]> {
  const cards = await searchTcgGoBinderCards(query, limit)
  return cards.map(pricedCardToCatalogHit)
}

function mergeCatalogHits(
  localHits: CatalogSearchHit[],
  liveHits: CatalogSearchHit[],
  supplementalHits: CatalogSearchHit[],
  query: string,
  limit: number,
): { hits: CatalogSearchHit[]; source: CatalogSearchSource } {
  if (supplementalHits.length > 0 && localHits.length === 0 && liveHits.length === 0) {
    return { hits: supplementalHits.slice(0, limit), source: "supplemental" }
  }

  if (liveHits.length === 0 && supplementalHits.length === 0) {
    return { hits: localHits.slice(0, limit), source: "local" }
  }
  if (localHits.length === 0 && liveHits.length === 0) {
    return { hits: supplementalHits.slice(0, limit), source: "supplemental" }
  }
  if (localHits.length === 0) {
    const merged = mergeBinderSearchResults(
      [...liveHits, ...supplementalHits].map((hit) => {
        const card = catalogHitToBinderCard(hit)
        return {
          id: card.id,
          name: card.name,
          set: card.set,
          rarity: card.rarity ?? "Common",
          image: card.image,
          cardNumber: card.cardNumber,
          rawPrice: hit.rawPrice,
        }
      }),
      query,
    )
    const byId = new Map<string, CatalogSearchHit>()
    for (const hit of [...liveHits, ...supplementalHits]) {
      if (!byId.has(hit.id)) byId.set(hit.id, hit)
    }
    const hits = merged
      .map((card) => byId.get(card.id))
      .filter((hit): hit is CatalogSearchHit => hit != null)
      .slice(0, limit)
    return { hits, source: liveHits.length > 0 ? "tcggo" : "supplemental" }
  }

  const merged = mergeBinderSearchResults(
    [...localHits, ...liveHits, ...supplementalHits].map((hit) => {
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
  for (const hit of [...localHits, ...liveHits, ...supplementalHits]) {
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
  const supplementalHits = searchSupplementalCatalog(query, limit)
  let liveHits: CatalogSearchHit[] = []

  if (shouldFetchLiveCatalog(query, [...localHits, ...supplementalHits], limit)) {
    try {
      liveHits = await fetchLiveCatalogHits(query, limit)
    } catch (error) {
      console.warn("[catalog-search] live TCGGO fallback failed:", error)
    }
  }

  const { hits, source } = mergeCatalogHits(localHits, liveHits, supplementalHits, query, limit)

  if (hits.length > 0 && (liveHits.length > 0 || supplementalHits.length > 0)) {
    const toPersist = [...liveHits, ...supplementalHits.filter((hit) => hits.some((result) => result.id === hit.id))]
    await persistLiveCatalogHits(toPersist).catch((error) => {
      console.warn("[catalog-search] persist supplemental/live hits failed:", error)
    })
  }

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
