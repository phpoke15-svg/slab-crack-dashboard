import type { MockCardEntry } from "@/lib/slab-data"

const STORAGE_KEY = "slabcrack-watchlist-v1"

export type WatchlistStore = {
  ids: string[]
  cards: Record<string, MockCardEntry>
}

function emptyStore(): WatchlistStore {
  return { ids: [], cards: {} }
}

export function loadWatchlistStore(): WatchlistStore {
  if (typeof window === "undefined") return emptyStore()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as WatchlistStore
    if (!Array.isArray(parsed.ids) || typeof parsed.cards !== "object") return emptyStore()
    return parsed
  } catch {
    return emptyStore()
  }
}

export function saveWatchlistStore(store: WatchlistStore): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function findWatchedIdForHit(
  store: WatchlistStore,
  hit: { id: string; cardName: string; setName: string; cardNumber: string },
  feedById: Map<string, MockCardEntry>,
): string | null {
  if (store.ids.includes(hit.id)) return hit.id

  for (const id of store.ids) {
    const card = store.cards[id] ?? feedById.get(id)
    if (
      card &&
      card.cardName === hit.cardName &&
      card.setName === hit.setName &&
      card.cardNumber === hit.cardNumber
    ) {
      return id
    }
  }

  return null
}

export function isSearchHitWatched(
  store: WatchlistStore,
  hit: { id: string; cardName: string; setName: string; cardNumber: string },
  feedById: Map<string, MockCardEntry>,
): boolean {
  return findWatchedIdForHit(store, hit, feedById) !== null
}

export function toggleWatchlistCard(
  store: WatchlistStore,
  card: MockCardEntry,
): WatchlistStore {
  const id = card.id
  if (store.ids.includes(id)) {
    const { [id]: _, ...cards } = store.cards
    return {
      ids: store.ids.filter((x) => x !== id),
      cards,
    }
  }

  return {
    ids: [id, ...store.ids.filter((x) => x !== id)],
    cards: { ...store.cards, [id]: card },
  }
}

export function isWatched(store: WatchlistStore, id: string): boolean {
  return store.ids.includes(id)
}

export function resolveWatchedCards(
  store: WatchlistStore,
  feedById: Map<string, MockCardEntry>,
): MockCardEntry[] {
  return store.ids
    .map((id) => feedById.get(id) ?? store.cards[id])
    .filter((card): card is MockCardEntry => Boolean(card))
}
