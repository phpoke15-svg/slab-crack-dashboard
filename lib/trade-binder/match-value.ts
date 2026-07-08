import { getRawPriceByCardId } from "@/lib/db/priced-catalog"
import { attachBinderCardPrices } from "@/lib/trade-binder/binder-prices"
import { cardIdVariants, nameSetKey } from "@/lib/trade-binder/card-id-match"
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
      limit: inputs.length,
      concurrency: 3,
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

  const priceByNameSet = new Map<string, number>()
  for (const card of cards) {
    const price = resolveCardPrice(card, priceById)
    if (!price) continue
    const key = nameSetKey(card.cardName, card.cardSet)
    if (key && !priceByNameSet.has(key)) priceByNameSet.set(key, price)
  }

  for (const card of byId.values()) {
    const direct = resolveCardPrice(card, priceById)
    if (direct) {
      card.rawPrice = direct
      continue
    }
    const key = nameSetKey(card.cardName, card.cardSet)
    const byName = key ? priceByNameSet.get(key) : undefined
    if (byName) card.rawPrice = byName
  }

  return [...byId.values()]
}

export function buildFairTradePairs(
  theyHaveYouWant: MatchCard[],
  youHaveTheyWant: MatchCard[],
  tolerance = MATCH_VALUE_TOLERANCE_DEFAULT,
): FairTradePair[] {
  const pairs: FairTradePair[] = []

  for (const theyCard of theyHaveYouWant) {
    if (!theyCard.rawPrice || theyCard.rawPrice <= 0) continue
    for (const youCard of youHaveTheyWant) {
      if (!youCard.rawPrice || youCard.rawPrice <= 0) continue
      const diff = valueDiffPercent(theyCard.rawPrice, youCard.rawPrice)
      if (diff <= tolerance * 100) {
        pairs.push({
          theyOffer: theyCard,
          youOffer: youCard,
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
  const theyIds = new Set(fairPairs.map((p) => p.theyOffer.cardId))
  const youIds = new Set(fairPairs.map((p) => p.youOffer.cardId))
  return {
    theyHaveYouWant: theyHaveYouWant.filter((c) => theyIds.has(c.cardId)),
    youHaveTheyWant: youHaveTheyWant.filter((c) => youIds.has(c.cardId)),
  }
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}
