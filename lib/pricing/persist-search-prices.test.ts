import { describe, expect, it, vi } from "vitest"
import {
  applySearchPricesToCards,
  binderPriceInputsFromCards,
  resolveSearchCardPrices,
} from "@/lib/pricing/persist-search-prices"

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
  it("uses card rawPrice, then cache", async () => {
    const prices = await resolveSearchCardPrices([
      { id: "inline", name: "Inline", set: "S", rawPrice: 7 },
      { id: "cached-1", name: "Cached", set: "S" },
      { id: "missing", name: "Missing", set: "S" },
    ])

    expect(prices.get("inline")).toBe(7)
    expect(prices.get("cached-1")).toBe(12.5)
    expect(prices.has("missing")).toBe(false)
  })
})
