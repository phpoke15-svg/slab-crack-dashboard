import { describe, expect, it, vi } from "vitest"
import {
  applySearchPricesToCards,
  binderPriceInputsFromCards,
  resolveSearchCardPrices,
} from "@/lib/pricing/persist-search-prices"

const freshSyncedAt = new Date().toISOString()

vi.mock("@/lib/db/priced-catalog", () => ({
  getRawPricesForCardIds: vi.fn(async (ids: string[]) => {
    const map = new Map<string, number>()
    for (const id of ids) {
      if (id === "cached-1") map.set(id, 12.5)
      if (id === "cached-2") map.set(id, 3)
    }
    return map
  }),
}))

vi.mock("@/lib/pricing/db", () => ({
  getCardPricesForIds: vi.fn(async (ids: string[]) => {
    const map = new Map<string, Record<string, unknown>>()
    for (const id of ids) {
      if (id === "fresh-cached") {
        map.set(id, {
          card_id: id,
          raw_price: 8.25,
          price_source: "tcggo",
          synced_at: freshSyncedAt,
          sync_error: null,
        })
      }
      if (id === "stale-inline") {
        map.set(id, {
          card_id: id,
          raw_price: 19.97,
          price_source: "tcggo",
          synced_at: "2020-01-01T00:00:00.000Z",
          sync_error: null,
        })
      }
    }
    return map
  }),
}))

vi.mock("@/lib/pricing/provider", () => ({
  getActivePriceProvider: vi.fn(() => "tcggo"),
  isCachedPriceFromActiveProvider: vi.fn((row: { price_source?: string }) => row.price_source === "tcggo"),
}))

describe("applySearchPricesToCards", () => {
  it("merges resolved prices onto cards", () => {
    const cards = [
      { id: "a", name: "A", set: "Set" },
      { id: "b", name: "B", set: "Set", rawPrice: 5 },
    ]
    const prices = new Map([
      ["a", 10],
      ["b", 99],
    ])

    expect(applySearchPricesToCards(cards, prices)).toEqual([
      { id: "a", name: "A", set: "Set", rawPrice: 10 },
      { id: "b", name: "B", set: "Set", rawPrice: 99 },
    ])
  })
})

describe("binderPriceInputsFromCards", () => {
  it("returns only unpriced cards up to max", () => {
    const inputs = binderPriceInputsFromCards(
      [
        { id: "1", name: "One", set: "S", rawPrice: 1 },
        { id: "2", name: "Two", set: "S" },
        { id: "3", name: "Three", set: "S", rawPrice: 0 },
      ],
      1,
    )

    expect(inputs).toEqual([{ id: "2", name: "Two", set: "S", cardNumber: undefined }])
  })
})

describe("resolveSearchCardPrices", () => {
  it("prefers fresh tcggo cache over catalog rawPrice", async () => {
    const prices = await resolveSearchCardPrices([
      { id: "fresh-cached", name: "Chimchar", set: "MEP", rawPrice: 19.97 },
      { id: "cached-1", name: "Cached", set: "S" },
      { id: "stale-inline", name: "Stale", set: "S", rawPrice: 19.97 },
      { id: "missing", name: "Missing", set: "S" },
    ])

    expect(prices.get("fresh-cached")).toBe(8.25)
    expect(prices.get("cached-1")).toBe(12.5)
    expect(prices.has("stale-inline")).toBe(false)
    expect(prices.has("missing")).toBe(false)
  })
})
