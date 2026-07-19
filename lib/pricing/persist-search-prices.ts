import { getRawPricesForCardIds } from "@/lib/db/priced-catalog"
import type { BinderPriceInput } from "@/lib/trade-binder/binder-prices"

/**
 * Cache-only pricing for batch flows (search results, match suggestions).
 * Live PriceCharting lookups happen via /api/cards/[id]/price on card click.
 */
export async function resolveSearchCardPrices(
  cards: BinderPriceInput[],
  options?: {
    limit?: number
  },
): Promise<Map<string, number>> {
  if (cards.length === 0) return new Map()

  const limit = options?.limit ?? cards.length
  const ids = cards.slice(0, limit).map((card) => card.id)
  const cachedPrices = await getRawPricesForCardIds(ids)
  const prices = new Map<string, number>()

  for (const card of cards.slice(0, limit)) {
    const price = cachedPrices.get(card.id)
    if (price && price > 0) prices.set(card.id, price)
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
