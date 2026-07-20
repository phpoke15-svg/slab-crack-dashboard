import type { CatalogSearchHit } from "@/lib/db/cards-catalog"
import { getRawPricesForCardIds } from "@/lib/db/priced-catalog"
import { getLazyCardPrice } from "@/lib/pricing/lazy-card-price"
import { getActivePriceProvider } from "@/lib/pricing/provider"
import type { BinderPriceInput } from "@/lib/trade-binder/binder-prices"

const PC_RATE_LIMIT_MS = 1100
const DEFAULT_LIVE_CONCURRENCY = 2

/** Max live PriceCharting lookups during a single search API request (rest via client backfill). */
export const SEARCH_SERVER_LIVE_PRICE_LIMIT = 40

const SEARCH_LIVE_TIME_BUDGET_MS = 25_000

export type SearchPriceOptions = {
  /** Max cards to look up from cache (default: all). */
  limit?: number
  /** Max live PriceCharting lookups for still-unpriced cards (default: all unpriced). */
  liveLimit?: number
  /** Parallel live lookups per batch (default: 2). */
  concurrency?: number
  /** Max wall-clock time for live lookups during one request. */
  timeBudgetMs?: number
  /** Skip live PriceCharting (cache-only). */
  cacheOnly?: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Cache lookup via card_prices + binder_card_prices with ID variant expansion. */
export async function resolveSearchCardPrices(
  cards: BinderPriceInput[],
  options?: Pick<SearchPriceOptions, "limit">,
): Promise<Map<string, number>> {
  if (cards.length === 0) return new Map()

  const limit = options?.limit ?? cards.length
  const slice = cards.slice(0, limit)
  const cachedPrices = await getRawPricesForCardIds(slice.map((card) => card.id))
  const prices = new Map<string, number>()

  for (const card of slice) {
    const fromCard = card.rawPrice && card.rawPrice > 0 ? card.rawPrice : undefined
    const fromCache = cachedPrices.get(card.id)
    const price = fromCard ?? (fromCache && fromCache > 0 ? fromCache : undefined)
    if (price && price > 0) prices.set(card.id, price)
  }

  return prices
}

/**
 * Resolve prices from cache, then live PriceCharting for any still-unpriced cards.
 * Used by PokeMatch search, binder enrichment, and match suggestions.
 */
export async function enrichSearchCardPrices(
  cards: BinderPriceInput[],
  options?: SearchPriceOptions,
): Promise<Map<string, number>> {
  const prices = await resolveSearchCardPrices(cards, { limit: options?.limit ?? cards.length })
  if (options?.cacheOnly) return prices

  const provider = getActivePriceProvider()
  if (!provider) return prices

  const unpriced = cards.filter((card) => {
    const existing = prices.get(card.id)
    return !existing || existing <= 0
  })

  if (unpriced.length === 0) return prices

  const liveLimit = options?.liveLimit ?? unpriced.length
  const concurrency = Math.max(1, options?.concurrency ?? DEFAULT_LIVE_CONCURRENCY)
  const timeBudgetMs = options?.timeBudgetMs ?? SEARCH_LIVE_TIME_BUDGET_MS
  const toFetch = unpriced.slice(0, liveLimit)
  const startedAt = Date.now()

  for (let i = 0; i < toFetch.length; i += concurrency) {
    if (Date.now() - startedAt >= timeBudgetMs) break

    const batch = toFetch.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async (card) => {
        const hit: CatalogSearchHit = {
          id: card.id,
          name: card.name,
          setName: card.set,
          setId: "",
          number: card.cardNumber ?? "",
          rarity: null,
          imageUrl: "",
          language: "en",
          japaneseName: null,
        }
        const result = await getLazyCardPrice(hit)
        if (result.rawPrice && result.rawPrice > 0) {
          prices.set(card.id, result.rawPrice)
        }
      }),
    )
    if (i + concurrency < toFetch.length) {
      await sleep(PC_RATE_LIMIT_MS)
    }
  }

  return prices
}

export function binderPriceInputsFromCards(
  cards: Array<{
    id: string
    name: string
    set: string
    cardNumber?: string
    rawPrice?: number
  }>,
  max = 20,
): BinderPriceInput[] {
  return cards
    .filter((card) => !card.rawPrice || card.rawPrice <= 0)
    .slice(0, max)
    .map((card) => ({
      id: card.id,
      name: card.name,
      set: card.set,
      cardNumber: card.cardNumber,
    }))
}

export function applySearchPricesToCards<T extends { id: string; rawPrice?: number }>(
  cards: T[],
  prices: Map<string, number>,
): T[] {
  if (prices.size === 0) return cards
  return cards.map((card) => {
    const price = prices.get(card.id)
    return price && price > 0 ? { ...card, rawPrice: price } : card
  })
}

export function applyPricesToCardSearchHits<T extends { id: string; rawPrice?: number }>(
  hits: T[],
  prices: Map<string, number>,
): T[] {
  return applySearchPricesToCards(hits, prices)
}

export async function enrichCardSearchHitsWithPrices<
  T extends { id: string; cardName: string; setName: string; cardNumber: string; rawPrice?: number },
>(hits: T[], options?: SearchPriceOptions): Promise<T[]> {
  if (hits.length === 0) return hits

  const inputs: BinderPriceInput[] = hits.map((hit) => ({
    id: hit.id,
    name: hit.cardName,
    set: hit.setName,
    cardNumber: hit.cardNumber,
    rawPrice: hit.rawPrice,
  }))
  const prices = await enrichSearchCardPrices(inputs, options)
  return applyPricesToCardSearchHits(hits, prices)
}
