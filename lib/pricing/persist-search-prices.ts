import { upsertBinderCardPrices } from "@/lib/db/binder-card-prices"
import { getRawPriceByCardId } from "@/lib/db/priced-catalog"
import { upsertCardPricesSafe } from "@/lib/pricing/db"
import {
  attachBinderCardPrices,
  type BinderPriceInput,
} from "@/lib/trade-binder/binder-prices"

function isPricingCacheOnly(): boolean {
  return process.env.PRICING_CACHE_ONLY === "true"
}

async function persistResolvedRawPrices(
  cards: BinderPriceInput[],
  prices: Map<string, number>,
): Promise<void> {
  const updates = cards
    .map((card) => {
      const rawPrice = prices.get(card.id) ?? 0
      if (rawPrice <= 0) return null
      return {
        target: {
          cardId: card.id,
          cardName: card.name,
          setName: card.set,
          cardNumber: card.cardNumber,
        },
        fetched: {
          rawPrice,
          psa7Price: 0,
          psa8Price: 0,
          psa9Price: 0,
          psa10Price: 0,
          priceSource: "pricecharting" as const,
        },
        syncError: null,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (updates.length === 0) return

  await upsertCardPricesSafe(updates).catch((error) => {
    console.warn("[pricing/search] card_prices persist failed:", error)
  })

  await upsertBinderCardPrices(
    updates.map((row) => ({
      cardId: row.target.cardId,
      rawPrice: row.fetched.rawPrice,
      cardName: row.target.cardName,
      cardSet: row.target.setName,
      cardNumber: row.target.cardNumber,
    })),
  ).catch((error) => {
    console.warn("[pricing/search] binder_card_prices persist failed:", error)
  })
}

/**
 * Cache-first pricing for user search flows.
 * Falls back to live PriceCharting unless PRICING_CACHE_ONLY=true.
 * Persists newly resolved prices into card_prices for later reads.
 */
export async function resolveSearchCardPrices(
  cards: BinderPriceInput[],
  options?: {
    limit?: number
    concurrency?: number
    cacheOnly?: boolean
  },
): Promise<Map<string, number>> {
  if (cards.length === 0) return new Map()

  const cacheOnly = options?.cacheOnly ?? isPricingCacheOnly()
  const cachedPrices = await getRawPriceByCardId()
  const prices = await attachBinderCardPrices(cards, {
    cachedPrices,
    limit: options?.limit ?? 20,
    concurrency: options?.concurrency ?? 2,
    cacheOnly,
  })

  if (!cacheOnly && prices.size > 0) {
    await persistResolvedRawPrices(cards, prices)
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
