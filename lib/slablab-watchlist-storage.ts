import type { SlabLabCard } from "@/lib/slablab"

const STORAGE_KEY = "slablab-watchlist-v1"

export type SlabLabWatchlistStore = {
  ids: string[]
  cards: Record<string, SlabLabCard>
}

function cardKey(card: SlabLabCard): string {
  return card.watchlistId || card.id
}

function emptyStore(): SlabLabWatchlistStore {
  return { ids: [], cards: {} }
}

export function loadSlabLabWatchlistStore(): SlabLabWatchlistStore {
  if (typeof window === "undefined") return emptyStore()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as SlabLabWatchlistStore
    if (!Array.isArray(parsed.ids) || typeof parsed.cards !== "object") return emptyStore()
    return parsed
  } catch {
    return emptyStore()
  }
}

export function saveSlabLabWatchlistStore(store: SlabLabWatchlistStore): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function toggleSlabLabWatchlistCard(
  store: SlabLabWatchlistStore,
  card: SlabLabCard,
): SlabLabWatchlistStore {
  const id = cardKey(card)
  if (store.ids.includes(id)) {
    const { [id]: _, ...cards } = store.cards
    return {
      ids: store.ids.filter((entry) => entry !== id),
      cards,
    }
  }

  return {
    ids: [id, ...store.ids.filter((entry) => entry !== id)],
    cards: { ...store.cards, [id]: card },
  }
}

export function isSlabLabWatched(store: SlabLabWatchlistStore, card: SlabLabCard): boolean {
  return store.ids.includes(cardKey(card))
}

export function resolveSlabLabWatchedCards(
  store: SlabLabWatchlistStore,
  liveById: Map<string, SlabLabCard>,
): SlabLabCard[] {
  return store.ids
    .map((id) => liveById.get(id) ?? store.cards[id])
    .filter((card): card is SlabLabCard => Boolean(card))
}
