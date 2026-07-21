import { describe, expect, it } from "vitest"
import { tcgResearchCardFullFromBundle } from "@/lib/tcg-research/card-full"
import type { CardPriceBundle } from "@/lib/scrydex/types"

const sampleBundle: CardPriceBundle = {
  card: {
    catalog_id: "pokemon-base1-4",
    game: "pokemon",
    scrydex_id: "base1-4",
    name: "Charizard",
    set_code: "base1",
    set_name: "Base Set",
    number: "4/102",
    rarity: "Rare Holo",
    image_small_url: "https://example.com/small.png",
    image_large_url: "https://example.com/large.png",
    variants: ["normal"],
    metadata: {},
  },
  raw: [
    {
      catalog_id: "pokemon-base1-4",
      variant: "normal",
      condition: "NM",
      market_price: 350,
      source: "scrydex",
      synced_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  graded: [
    {
      catalog_id: "pokemon-base1-4",
      variant: "normal",
      company: "PSA",
      grade: "10",
      market_price: 1200,
      source: "scrydex",
      synced_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  population: [
    {
      catalog_id: "pokemon-base1-4",
      variant: "normal",
      company: "PSA",
      grade: "10",
      count: 5000,
      grade_total: 12000,
    },
  ],
  history: [],
  creditsUsed: 0,
}

describe("tcgResearchCardFullFromBundle", () => {
  it("maps a Scrydex bundle into a TCG Research panel payload", () => {
    const full = tcgResearchCardFullFromBundle(sampleBundle)

    expect(full.catalogId).toBe("pokemon-base1-4")
    expect(full.scrydexId).toBe("base1-4")
    expect(full.game).toBe("pokemon")
    expect(full.card.cardName).toBe("Charizard")
    expect(full.card.setName).toBe("Base Set")
    expect(full.card.rawPrice).toBeGreaterThan(0)
    expect(full.gradedPrices.some((row) => row.company === "PSA" && row.grade === "10")).toBe(true)
    expect(full.population.some((row) => row.grade === "10")).toBe(true)
    expect(full.priceSource).toBe("scrydex")
  })
})
