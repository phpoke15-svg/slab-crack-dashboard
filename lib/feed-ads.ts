import type { MockCardEntry } from "@/lib/slab-data"

export const DEFAULT_FEED_AD_INTERVAL = 5
export const DEFAULT_GRID_AD_INTERVAL = 8
export const DEFAULT_MATCH_AD_INTERVAL = 3

function parseInterval(raw: string | undefined, fallback: number): number {
  const fromEnv = Number(raw)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : fallback
}

export function getFeedAdInterval(): number {
  return parseInterval(process.env.NEXT_PUBLIC_FEED_AD_INTERVAL, DEFAULT_FEED_AD_INTERVAL)
}

export function getGridAdInterval(): number {
  return parseInterval(process.env.NEXT_PUBLIC_GRID_AD_INTERVAL, DEFAULT_GRID_AD_INTERVAL)
}

export function getMatchAdInterval(): number {
  return parseInterval(process.env.NEXT_PUBLIC_MATCH_AD_INTERVAL, DEFAULT_MATCH_AD_INTERVAL)
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
