import { describe, expect, it } from "vitest"
import type { SlabLabCard } from "@/lib/slablab"
import {
  isSlabLabWatched,
  toggleSlabLabWatchlistCard,
} from "@/lib/slablab-watchlist-storage"

const card: SlabLabCard = {
  id: "lab-1",
  watchlistId: "pc-123",
  name: "Pikachu",
  set: "Base",
  era: "Wizards",
  yearsAgo: 20,
  rawPrice: 10,
  psa10Price: 40,
  psa9Price: 15,
  image: "",
  cardNumber: "58",
}

describe("slablab-watchlist-storage", () => {
  it("toggles cards by watchlistId", () => {
    let store = { ids: [] as string[], cards: {} as Record<string, SlabLabCard> }
    store = toggleSlabLabWatchlistCard(store, card)
    expect(isSlabLabWatched(store, card)).toBe(true)
    expect(store.ids).toEqual(["pc-123"])

    store = toggleSlabLabWatchlistCard(store, card)
    expect(isSlabLabWatched(store, card)).toBe(false)
    expect(store.ids).toEqual([])
  })
})
