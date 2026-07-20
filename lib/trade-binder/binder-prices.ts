import { fetchCardPricesForTarget } from "@/lib/pricing/fetch"
import { getActivePriceProvider, getPriceChartingApiKey } from "@/lib/pricing/provider"
import {
  extractCardPrices,
  resolvePriceChartingForCard,
} from "@/lib/pricecharting"

export type BinderPriceInput = {
  id: string
  name: string
  set: string
  cardNumber?: string
}

export function parseBinderCardNumber(name: string, cardNumber?: string): string {
  return cardNumber || name.match(/#(\d+[a-zA-Z/-]*)/)?.[1] || ""
}

async function resolveBinderCardPriceLegacyPc(
  apiKey: string,
  input: BinderPriceInput,
): Promise<number> {
  const priceChartingId = input.id.startsWith("pc-") ? input.id.replace(/^pc-/, "") : undefined
  const cardNumber = parseBinderCardNumber(input.name, input.cardNumber)

  try {
    const { product } = await Promise.race([
      resolvePriceChartingForCard(apiKey, {
        cardName: input.name,
        setName: input.set,
        cardNumber,
        priceChartingId,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Price lookup timed out")), 4500),
      ),
    ])
    return extractCardPrices(product).rawPrice
  } catch {
    return 0
  }
}

export async function resolveBinderCardPrice(
  input: BinderPriceInput,
  cachedPrice?: number,
): Promise<number> {
  if (cachedPrice && cachedPrice > 0) return cachedPrice

  const provider = getActivePriceProvider()
  if (!provider) return 0

  try {
    if (provider === "tcggo") {
      const fetched = await Promise.race([
        fetchCardPricesForTarget({
          cardId: input.id,
          cardName: input.name,
          setName: input.set,
          cardNumber: input.cardNumber,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Price lookup timed out")), 4500),
        ),
      ])
      return fetched.rawPrice
    }

    const apiKey = getPriceChartingApiKey()
    if (!apiKey) return 0
    return resolveBinderCardPriceLegacyPc(apiKey, input)
  } catch {
    return 0
  }
}

export async function attachBinderCardPrices(
  cards: BinderPriceInput[],
  options?: {
    cachedPrices?: Map<string, number>
    limit?: number
    concurrency?: number
    /** When true, never call live pricing during a user request. */
    cacheOnly?: boolean
  },
): Promise<Map<string, number>> {
  const provider = getActivePriceProvider()
  const result = new Map<string, number>()
  const cacheOnly = options?.cacheOnly ?? false
  if (!provider && !cacheOnly) return result

  const cached = options?.cachedPrices ?? new Map<string, number>()
  const concurrency = options?.concurrency ?? 2
  const limit = options?.limit ?? 24

  for (const card of cards) {
    const cachedPrice = cached.get(card.id)
    if (cachedPrice && cachedPrice > 0) {
      result.set(card.id, cachedPrice)
    }
  }

  if (cacheOnly) return result
  if (!provider) return result

  const toFetch = cards.filter((card) => !result.has(card.id)).slice(0, limit)

  for (let i = 0; i < toFetch.length; i += concurrency) {
    const batch = toFetch.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async (card) => {
        const price = await resolveBinderCardPrice(card)
        if (price > 0) result.set(card.id, price)
      }),
    )
  }

  return result
}

export function mergePricesIntoCards<T extends { id: string; rawPrice?: number }>(
  cards: T[],
  prices: Map<string, number>,
): T[] {
  if (prices.size === 0) return cards
  return cards.map((card) => {
    const price = prices.get(card.id)
    return price && price > 0 ? { ...card, rawPrice: price } : card
  })
}
