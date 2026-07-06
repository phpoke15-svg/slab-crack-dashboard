import type { MockCardEntry } from "@/lib/slab-data"

export const DEFAULT_FEED_AD_INTERVAL = 10

export function getFeedAdInterval(): number {
  const fromEnv = Number(process.env.NEXT_PUBLIC_FEED_AD_INTERVAL)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_FEED_AD_INTERVAL
}

export type FeedListItem =
  | { kind: "card"; card: MockCardEntry }
  | { kind: "ad"; slotIndex: number }

/** Insert an ad slot after every N cards (not after the final card). */
export function interleaveFeedAds(
  cards: MockCardEntry[],
  interval = getFeedAdInterval(),
): FeedListItem[] {
  if (interval <= 0) {
    return cards.map((card) => ({ kind: "card", card }))
  }

  const items: FeedListItem[] = []
  let adSlot = 0

  for (let i = 0; i < cards.length; i += 1) {
    items.push({ kind: "card", card: cards[i]! })
    const isTenth = (i + 1) % interval === 0
    const hasMoreCards = i < cards.length - 1
    if (isTenth && hasMoreCards) {
      adSlot += 1
      items.push({ kind: "ad", slotIndex: adSlot })
    }
  }

  return items
}
