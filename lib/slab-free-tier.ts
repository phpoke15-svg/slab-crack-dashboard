/** Free SlabCrack: a small sample from the middle of the deficit ranking (not the top chase deals). */

export const FREE_SLABCRACK_LIMIT = 10

type DeficitCard = {
  deficit: number
  hasPricing?: boolean
}

/**
 * Sort by deficit (high → low), then take `limit` cards centered on the median.
 * Paid users get the full feed; free users see mid-tier opportunities only.
 */
export function pickMidDeficitCards<T extends DeficitCard>(
  cards: T[],
  limit = FREE_SLABCRACK_LIMIT,
): T[] {
  const ranked = cards
    .filter((c) => c.hasPricing !== false && c.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit)

  if (ranked.length <= limit) return ranked

  const start = Math.floor((ranked.length - limit) / 2)
  return ranked.slice(start, start + limit)
}
