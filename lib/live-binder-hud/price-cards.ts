import "server-only"
import { fetchCardPricesForTarget } from "@/lib/pricing/fetch"
import { hasTcgGoApiKey } from "@/lib/pricing/provider"

export type BinderPriceRequest = {
  slot: number
  name: string
  set?: string
  number?: string
}

export type BinderPriceResult =
  | {
      ok: true
      slot: number
      name: string
      set: string
      number: string
      productName: string
      consoleName: string
      productId: string | null
      prices: {
        rawNm: number
        psa7: number
        psa8: number
        psa9: number
        psa10: number
      }
      trend: {
        rawNm: number
        gradedSpread: number | null
        bestGrade: { grade: number; price: number } | null
      }
    }
  | {
      ok: false
      slot: number
      name: string
      set: string
      number: string
      error: string
    }

const PRICE_LOOKUP_CONCURRENCY = 4

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor
        cursor += 1
        out[i] = await worker(items[i]!, i)
      }
    }),
  )
  return out
}

async function priceOneBinderCard(card: BinderPriceRequest): Promise<BinderPriceResult> {
  try {
    if (!hasTcgGoApiKey()) {
      throw new Error("RAPIDAPI_POKEMON_TCG_KEY is not configured.")
    }

    const fetched = await fetchCardPricesForTarget({
      cardId: `poke-${card.name}`,
      cardName: card.name,
      setName: card.set || "",
      cardNumber: card.number,
    })
    const psa7 = fetched.psa7Price
    const psa8 = fetched.psa8Price
    const psa9 = fetched.psa9Price
    const psa10 = fetched.psa10Price
    const rawPrice = fetched.rawPrice
    const bestGrade =
      [
        { grade: 10, price: psa10 },
        { grade: 9, price: psa9 },
        { grade: 8, price: psa8 },
        { grade: 7, price: psa7 },
      ].find((g) => g.price > 0) || null

    return {
      ok: true,
      slot: card.slot,
      name: card.name,
      set: card.set || "",
      number: card.number || "",
      productName: card.name,
      consoleName: card.set || "",
      productId: fetched.tcgId ?? null,
      prices: { rawNm: rawPrice, psa7, psa8, psa9, psa10 },
      trend: {
        rawNm: rawPrice,
        gradedSpread:
          rawPrice > 0 && psa10 > 0 ? Number((psa10 - rawPrice).toFixed(2)) : null,
        bestGrade,
      },
    }
  } catch (err) {
    return {
      ok: false,
      slot: card.slot,
      name: card.name,
      set: card.set || "",
      number: card.number || "",
      error: err instanceof Error ? err.message : "Price lookup failed",
    }
  }
}

export async function priceBinderCards(
  cards: BinderPriceRequest[],
  _apiKeyOverride?: string,
): Promise<BinderPriceResult[]> {
  if (!hasTcgGoApiKey()) {
    throw new Error("RAPIDAPI_POKEMON_TCG_KEY is not configured.")
  }

  return mapPool(cards, PRICE_LOOKUP_CONCURRENCY, (card) => priceOneBinderCard(card))
}
