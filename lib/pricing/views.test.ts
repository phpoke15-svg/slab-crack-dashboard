import { describe, expect, it } from "vitest"
import { cardPriceRowToMockEntry, mergeCachedRawPrices } from "@/lib/pricing/views"
import type { CardPriceRow } from "@/lib/pricing/types"

describe("mergeCachedRawPrices", () => {
  it("prefers primary map and fills gaps from fallback", () => {
    const primary = new Map([["poke-a", 10], ["poke-b", 20]])
    const fallback = new Map([
      ["poke-b", 99],
      ["poke-c", 30],
    ])

    const merged = mergeCachedRawPrices(primary, fallback)
    expect(merged.get("poke-a")).toBe(10)
    expect(merged.get("poke-b")).toBe(20)
    expect(merged.get("poke-c")).toBe(30)
  })
})

describe("cardPriceRowToMockEntry", () => {
  it("builds grade quotes and arbitrage from cached row", () => {
    const row: CardPriceRow = {
      card_id: "pc-123",
      raw_price: 100,
      psa7_price: 80,
      psa8_price: 85,
      psa9_price: 90,
      psa10_price: 95,
      price_source: "pricecharting",
      synced_at: "2026-07-17T03:00:00.000Z",
      sync_error: null,
      card_name: "Charizard",
      card_set: "Base Set",
      card_number: "4",
    }

    const entry = cardPriceRowToMockEntry(row, { imageUrl: "https://example.com/card.jpg" })
    expect(entry.rawPrice).toBe(100)
    expect(entry.hasPricing).toBe(true)
    expect(entry.gradeQuotes.some((q) => q.grade === 7 && q.slabPrice === 80)).toBe(true)
    expect(entry.deficit).toBeGreaterThan(0)
    expect(entry.imageUrl).toBe("https://example.com/card.jpg")
  })
})
