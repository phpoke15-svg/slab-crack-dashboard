import { describe, expect, it } from "vitest"
import { mergeTcgResearchCardDetails } from "@/lib/tcg-research/card-detail"

describe("mergeTcgResearchCardDetails", () => {
  it("merges local and Scrydex bundle prices without dropping graded rows", () => {
    const merged = mergeTcgResearchCardDetails(
      {
        id: "poke-mep-41",
        catalogId: "pokemon-mep-41",
        scrydexId: "mep-41",
        game: "pokemon",
        name: "Chimchar",
        setName: "Mega Evolution Black Star Promos",
        setId: "mep",
        number: "41",
        rarity: "Common",
        imageUrl: "/local.png",
        rawPrice: 19.97,
        psa7Price: null,
        psa8Price: null,
        psa9Price: null,
        psa10Price: null,
        priceUpdatedAt: "2026-07-21T00:00:00.000Z",
        priceTrend: null,
      },
      {
        id: "poke-mep-41",
        catalogId: "pokemon-mep-41",
        scrydexId: "mep-41",
        game: "pokemon",
        name: "Chimchar",
        setName: "Mega Evolution Black Star Promos",
        setId: "mep",
        number: "41",
        rarity: "Common",
        imageUrl: "https://images.scrydex.com/pokemon/mep-41/large",
        rawPrice: 6.5,
        psa7Price: 12,
        psa8Price: 18,
        psa9Price: 28,
        psa10Price: 45,
        priceUpdatedAt: "2026-07-22T00:00:00.000Z",
        priceTrend: "up",
      },
    )

    expect(merged.rawPrice).toBe(6.5)
    expect(merged.psa10Price).toBe(45)
    expect(merged.psa9Price).toBe(28)
    expect(merged.imageUrl).toContain("scrydex")
    expect(merged.priceTrend).toBe("up")
  })
})
