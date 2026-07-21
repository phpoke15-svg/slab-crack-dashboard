import type { CatalogSearchHit } from "@/lib/db/cards-catalog"
import type { CardPriceRow } from "@/lib/pricing/types"
import { getRawPricesForCardIds } from "@/lib/db/priced-catalog"
import { getCardPricesForIds } from "@/lib/pricing/db"
import { getLazyCardPrice } from "@/lib/pricing/lazy-card-price"
import { getActivePriceProvider, isCachedPriceFromActiveProvider } from "@/lib/pricing/provider"
import { isScrydexConfigured } from "@/lib/scrydex/constants"
import { getScrydexRawPricesForIds } from "@/lib/scrydex/price-adapter"
import { ensureScrydexCardFresh } from "@/lib/scrydex/on-demand"
import type { BinderPriceInput } from "@/lib/trade-binder/binder-prices"
import { promoCardMeta } from "@/lib/trade-binder/promo-card-meta"

const PC_RATE_LIMIT_MS = 1100
const DEFAULT_LIVE_CONCURRENCY = 2
const SEARCH_PRICE_TTL_MS = 24 * 60 * 60 * 1000

/** Max live PriceCharting lookups during a single search API request (rest via client backfill). */
export const SEARCH_SERVER_LIVE_PRICE_LIMIT = 40

const SEARCH_LIVE_TIME_BUDGET_MS = 25_000
const SCRYDEX_REFRESH_LIMIT = 16

export type SearchPriceOptions = {
  /** Max cards to look up from cache (default: all). */
  limit?: number
  /** Max live PriceCharting lookups for still-unpriced cards (default: all unpriced). */
  liveLimit?: number
  /** Max Scrydex on-demand refreshes for still-unpriced cards (default: 16). */
  scrydexRefreshLimit?: number
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

function isFreshSyncedAt(syncedAt: string | null | undefined): boolean {
  if (!syncedAt) return false
  return Date.now() - new Date(syncedAt).getTime() < SEARCH_PRICE_TTL_MS
}

function hasUsableCachedRawPrice(row: CardPriceRow): boolean {
  return (row.raw_price ?? 0) > 0 && row.sync_error !== "unavailable"
}

/** Cache lookup via card_prices + binder_card_prices with ID variant expansion. */
export async function resolveSearchCardPrices(
  cards: BinderPriceInput[],
  options?: Pick<SearchPriceOptions, "limit">,
): Promise<Map<string, number>> {
  if (cards.length === 0) return new Map()

  const limit = options?.limit ?? cards.length
  const slice = cards.slice(0, limit)
  const provider = getActivePriceProvider()
  const [cachedPrices, priceRows] = await Promise.all([
    getRawPricesForCardIds(slice.map((card) => card.id)),
    provider ? getCardPricesForIds(slice.map((card) => card.id)) : Promise.resolve(new Map()),
  ])
  const prices = new Map<string, number>()

  for (const card of slice) {
    const row = priceRows.get(card.id)
    const skipCache = Boolean(promoCardMeta(card.id))
    const fromCache =
      !skipCache &&
      provider &&
      row &&
      isCachedPriceFromActiveProvider(row, provider) &&
      isFreshSyncedAt(row.synced_at) &&
      hasUsableCachedRawPrice(row)
        ? row.raw_price!
        : skipCache
          ? undefined
          : cachedPrices.get(card.id)

    const fromCard =
      !provider && card.rawPrice && card.rawPrice > 0 ? card.rawPrice : undefined

    const price =
      fromCache && fromCache > 0
        ? fromCache
        : fromCard && fromCard > 0
          ? fromCard
          : undefined
    if (price && price > 0) prices.set(card.id, price)
  }

  return prices
}

async function refreshScrydexPricesForUnpriced(
  cards: BinderPriceInput[],
  prices: Map<string, number>,
  limit: number,
): Promise<Map<string, number>> {
  if (!isScrydexConfigured() || typeof window !== "undefined" || limit <= 0) return prices

  const needRefresh = cards
    .filter((card) => {
      const existing = prices.get(card.id)
      return !existing || existing <= 0
    })
    .slice(0, limit)

  if (needRefresh.length === 0) return prices

  await Promise.all(
    needRefresh.map((card) => ensureScrydexCardFresh(card.id, { activity: "view" })),
  )

  const refreshed = await getScrydexRawPricesForIds(needRefresh.map((card) => card.id))
  for (const [id, price] of refreshed) {
    if (price > 0) prices.set(id, price)
  }

  return prices
}

/**
 * Resolve prices from cache, then Scrydex on-demand, then live TCGGO for any still-unpriced cards.
 * Used by PokeMatch search, binder enrichment, and match suggestions.
 */
export async function enrichSearchCardPrices(
  cards: BinderPriceInput[],
  options?: SearchPriceOptions,
): Promise<Map<string, number>> {
  let prices = await resolveSearchCardPrices(cards, { limit: options?.limit ?? cards.length })
  if (options?.cacheOnly) return prices

  prices = await refreshScrydexPricesForUnpriced(
    cards,
    prices,
    options?.scrydexRefreshLimit ?? SCRYDEX_REFRESH_LIMIT,
  )

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
