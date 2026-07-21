import { describe, expect, it } from "vitest"
import { rankedCardRowToMockEntry } from "@/lib/db/top-ranked-cards"

describe("rankedCardRowToMockEntry", () => {
  it("builds deficit metrics from denormalized prices", () => {
    const entry = rankedCardRowToMockEntry({
      id: "poke-sv3pt5-173",
      name: "Charizard ex",
      set_name: "151",
      set_id: "sv3pt5",
      number: "173",
      rarity: "Double Rare",
      image_url: "https://example.com/card.png",
      scrydex_id: "sv3pt5-173",
      current_price_raw: 12,
      current_price_psa10: 250,
      price_updated_at: "2026-07-21T00:00:00.000Z",
    })

    expect(entry).not.toBeNull()
    expect(entry?.rawPrice).toBe(12)
    expect(entry?.slabPrice).toBe(250)
    expect(entry?.deficit).toBe(0)
    expect(entry?.hasPricing).toBe(true)
  })

  it("returns null when prices are missing", () => {
    expect(
      rankedCardRowToMockEntry({
        id: "poke-test-1",
        name: "Test",
        set_name: "Test Set",
        set_id: "test",
        number: "1",
        rarity: null,
        image_url: null,
        scrydex_id: "test-1",
        current_price_raw: null,
        current_price_psa10: null,
        price_updated_at: null,
      }),
    ).toBeNull()
  })
})
