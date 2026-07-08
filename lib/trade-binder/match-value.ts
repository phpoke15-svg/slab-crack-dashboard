import type { FairTradePair, MatchCard } from "@/lib/trade-binder/users"

export const MATCH_VALUE_TOLERANCE_MIN = 0.05
export const MATCH_VALUE_TOLERANCE_MAX = 0.1
export const MATCH_VALUE_TOLERANCE_DEFAULT = 0.06

const PRICE_CHUNK = 20

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
    if (card.rawPrice && card.rawPrice > 0) priceById.set(card.cardId, card.rawPrice)
  }

  try {
    const chunks: MatchCard[][] = []
    for (let i = 0; i < needPrice.length; i += PRICE_CHUNK) {
      chunks.push(needPrice.slice(i, i + PRICE_CHUNK))
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
        if (price > 0) priceById.set(id, price)
      }
    }
  } catch {
    return [...byId.values()]
  }

  for (const [id, card] of byId) {
    const price = priceById.get(id)
    if (price && price > 0) card.rawPrice = price
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
