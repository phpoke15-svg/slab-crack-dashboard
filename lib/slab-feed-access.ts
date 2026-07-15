/** Feed limits for SlabCrack + SlabLab by membership tier. */

export const FREE_SLAB_FEED_LIMIT = 10
export const PREMIUM_SLAB_FEED_LIMIT = 100

export type SlabFeedAccess = "preview" | "top100" | "full"

type RankedCard = {
  hasPricing?: boolean
}

function rankedByScore<T extends RankedCard>(cards: T[], score: (card: T) => number): T[] {
  return cards
    .filter((c) => c.hasPricing !== false && score(c) > 0)
    .sort((a, b) => score(b) - score(a))
}

/** Mid-ranked sample — not the top chase opportunities (SlabCrack free / SlabLab free). */
export function pickMidRankedCards<T extends RankedCard>(
  cards: T[],
  score: (card: T) => number,
  limit = FREE_SLAB_FEED_LIMIT,
): T[] {
  const ranked = rankedByScore(cards, score)
  if (ranked.length <= limit) return ranked
  const start = Math.floor((ranked.length - limit) / 2)
  return ranked.slice(start, start + limit)
}

export function pickTopRankedCards<T extends RankedCard>(
  cards: T[],
  score: (card: T) => number,
  limit: number,
): T[] {
  return rankedByScore(cards, score).slice(0, limit)
}

export function limitSlabFeed<T extends RankedCard>(
  cards: T[],
  access: SlabFeedAccess,
  score: (card: T) => number,
): T[] {
  if (access === "full") return cards
  if (access === "preview") return pickMidRankedCards(cards, score, FREE_SLAB_FEED_LIMIT)
  return pickTopRankedCards(cards, score, PREMIUM_SLAB_FEED_LIMIT)
}

/** @deprecated Use FREE_SLAB_FEED_LIMIT */
export const FREE_SLABCRACK_LIMIT = FREE_SLAB_FEED_LIMIT

/** @deprecated Use pickMidRankedCards with deficit score */
export function pickMidDeficitCards<T extends { deficit: number; hasPricing?: boolean }>(
  cards: T[],
  limit = FREE_SLAB_FEED_LIMIT,
): T[] {
  return pickMidRankedCards(cards, (c) => c.deficit, limit)
}
