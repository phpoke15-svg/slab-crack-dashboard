import type { MockCardEntry } from "@/lib/slab-data"
import { isAdsDisplayEnabled } from "@/lib/adsense-config"

/** Hardcoded so Vercel env cannot silently keep ads at every 10 cards. */
export const FEED_AD_INTERVAL = 5
export const GRID_AD_INTERVAL = 8
export const MATCH_AD_INTERVAL = 3

export const DEFAULT_FEED_AD_INTERVAL = FEED_AD_INTERVAL
export const DEFAULT_GRID_AD_INTERVAL = GRID_AD_INTERVAL
export const DEFAULT_MATCH_AD_INTERVAL = MATCH_AD_INTERVAL

export function getFeedAdInterval(): number {
  return isAdsDisplayEnabled() ? FEED_AD_INTERVAL : 0
}

export function getGridAdInterval(): number {
  return isAdsDisplayEnabled() ? GRID_AD_INTERVAL : 0
}

export function getMatchAdInterval(): number {
  return isAdsDisplayEnabled() ? MATCH_AD_INTERVAL : 0
}

export type InterleavedItem<T> =
  | { kind: "item"; value: T }
  | { kind: "ad"; slotIndex: number }

/** Insert an ad slot after every N items (not after the final item). */
export function interleaveWithAds<T>(
  items: T[],
  interval: number,
): InterleavedItem<T>[] {
  if (interval <= 0) {
    return items.map((value) => ({ kind: "item", value }))
  }

  const result: InterleavedItem<T>[] = []
  let adSlot = 0

  for (let i = 0; i < items.length; i += 1) {
    result.push({ kind: "item", value: items[i]! })
    const isInterval = (i + 1) % interval === 0
    const hasMore = i < items.length - 1
    if (isInterval && hasMore) {
      adSlot += 1
      result.push({ kind: "ad", slotIndex: adSlot })
    }
  }

  return result
}

export type FeedListItem =
  | { kind: "card"; card: MockCardEntry }
  | { kind: "ad"; slotIndex: number }

/** Insert an ad slot after every N cards (not after the final card). */
export function interleaveFeedAds(
  cards: MockCardEntry[],
  interval = getFeedAdInterval(),
): FeedListItem[] {
  return interleaveWithAds(cards, interval).map((item) =>
    item.kind === "item" ? { kind: "card", card: item.value } : item,
  )
}
