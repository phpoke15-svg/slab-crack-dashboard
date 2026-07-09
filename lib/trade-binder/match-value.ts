import { getRawPriceByCardId } from "@/lib/db/priced-catalog"
import { attachBinderCardPrices } from "@/lib/trade-binder/binder-prices"
import {
  cardIdVariants,
  cardIdentityKey,
  cardsMatchIdentity,
} from "@/lib/trade-binder/card-id-match"
import type { FairTradePair, MatchCard } from "@/lib/trade-binder/users"

export const MATCH_VALUE_TOLERANCE_MIN = 0.05
export const MATCH_VALUE_TOLERANCE_MAX = 0.1
export const MATCH_VALUE_TOLERANCE_DEFAULT = 0.06

const PRICE_CHUNK = 20

function registerPrice(priceById: Map<string, number>, cardId: string, price: number) {
  if (price <= 0) return
  for (const variant of cardIdVariants(cardId)) {
    if (!priceById.has(variant)) priceById.set(variant, price)
  }
}

function resolveCardPrice(card: MatchCard, priceById: Map<string, number>): number | undefined {
  if (card.rawPrice && card.rawPrice > 0) return card.rawPrice
  for (const variant of cardIdVariants(card.cardId)) {
    const price = priceById.get(variant)
    if (price && price > 0) return price
  }
  return undefined
}

export function resolveMatchCardPrice(
  card: MatchCard,
  pricedCards: MatchCard[],
  priceById: Map<string, number>,
): number | undefined {
  const direct = resolveCardPrice(card, priceById)
  if (direct && direct > 0) return direct

  for (const other of pricedCards) {
    if (!other.rawPrice || other.rawPrice <= 0) continue
    if (cardIdVariants(card.cardId).some((id) => cardIdVariants(other.cardId).includes(id))) {
      return other.rawPrice
    }
    if (cardsMatchIdentity(card, other)) return other.rawPrice
  }

  return undefined
}

async function fetchMatchCardPrices(cards: MatchCard[]): Promise<Map<string, number>> {
  const priceById = new Map<string, number>()
  if (cards.length === 0) return priceById

  const inputs = cards.map((card) => ({
    id: card.cardId,
    name: card.cardName,
    set: card.cardSet,
    cardNumber: card.cardNumber ?? card.cardName.match(/#(\d+[a-zA-Z/-]*)/)?.[1],
  }))

  if (typeof window === "undefined") {
    const cachedPrices = await getRawPriceByCardId()
    const prices = await attachBinderCardPrices(inputs, {
      cachedPrices,
      limit: Math.min(inputs.length, 80),
      concurrency: 4,
    })
    for (const [id, price] of prices) registerPrice(priceById, id, price)
    return priceById
  }

  const chunks: MatchCard[][] = []
  for (let i = 0; i < cards.length; i += PRICE_CHUNK) {
    chunks.push(cards.slice(i, i + PRICE_CHUNK))
  }

  const responses = await Promise.all(
    chunks.map((chunk) =>
      fetch("/api/binder/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          cards: chunk.map((card) => ({
            id: card.cardId,
            name: card.cardName,
            set: card.cardSet,
            cardNumber: card.cardNumber ?? card.cardName.match(/#(\d+[a-zA-Z/-]*)/)?.[1],
          })),
        }),
      }),
    ),
  )

  for (const res of responses) {
    if (!res.ok) continue
    const data = (await res.json()) as { prices?: Record<string, number> }
    for (const [id, price] of Object.entries(data.prices ?? {})) {
      registerPrice(priceById, id, price)
    }
  }

  return priceById
}

export function valueDiffPercent(a: number, b: number): number {
  const max = Math.max(a, b)
  if (max <= 0) return 100
  return (Math.abs(a - b) / max) * 100
}

export function valuesWithinTolerance(
  a: number,
  b: number,
  tolerance = MATCH_VALUE_TOLERANCE_DEFAULT,
): boolean {
  return valueDiffPercent(a, b) <= tolerance * 100
}

export async function enrichMatchCardsWithPrices(cards: MatchCard[]): Promise<MatchCard[]> {
  const byId = new Map(cards.map((c) => [c.cardId, { ...c }]))
  const needPrice = cards.filter((c) => !c.rawPrice || c.rawPrice <= 0)
  if (needPrice.length === 0) return [...byId.values()]

  const priceById = new Map<string, number>()
  for (const card of cards) {
    if (card.rawPrice && card.rawPrice > 0) registerPrice(priceById, card.cardId, card.rawPrice)
  }

  try {
    const fetched = await fetchMatchCardPrices(needPrice)
    for (const [id, price] of fetched) registerPrice(priceById, id, price)
  } catch {
    return [...byId.values()]
  }

  const pricedList = [...byId.values()]
  for (const card of pricedList) {
    const price = resolveMatchCardPrice(card, pricedList, priceById)
    if (price) card.rawPrice = price
  }

  return pricedList
}

export function buildFairTradePairs(
  theyHaveYouWant: MatchCard[],
  youHaveTheyWant: MatchCard[],
  tolerance = MATCH_VALUE_TOLERANCE_DEFAULT,
): FairTradePair[] {
  const pairs: FairTradePair[] = []
  const priced = [...theyHaveYouWant, ...youHaveTheyWant]
  const priceById = new Map<string, number>()
  for (const card of priced) {
    if (card.rawPrice && card.rawPrice > 0) registerPrice(priceById, card.cardId, card.rawPrice)
  }

  for (const theyCard of theyHaveYouWant) {
    const theyPrice = resolveMatchCardPrice(theyCard, priced, priceById)
    if (!theyPrice || theyPrice <= 0) continue

    for (const youCard of youHaveTheyWant) {
      const youPrice = resolveMatchCardPrice(youCard, priced, priceById)
      if (!youPrice || youPrice <= 0) continue

      const diff = valueDiffPercent(theyPrice, youPrice)
      if (diff <= tolerance * 100) {
        pairs.push({
          theyOffer: { ...theyCard, rawPrice: theyPrice },
          youOffer: { ...youCard, rawPrice: youPrice },
          valueDiffPercent: diff,
        })
      }
    }
  }

  pairs.sort((a, b) => a.valueDiffPercent - b.valueDiffPercent)
  return pairs
}

export function filterCardsToFairPairs(
  theyHaveYouWant: MatchCard[],
  youHaveTheyWant: MatchCard[],
  fairPairs: FairTradePair[],
): { theyHaveYouWant: MatchCard[]; youHaveTheyWant: MatchCard[] } {
  return {
    theyHaveYouWant: theyHaveYouWant.filter((card) =>
      fairPairs.some((pair) => cardsMatchIdentity(pair.theyOffer, card)),
    ),
    youHaveTheyWant: youHaveTheyWant.filter((card) =>
      fairPairs.some((pair) => cardsMatchIdentity(pair.youOffer, card)),
    ),
  }
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}
