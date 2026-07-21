import { describe, expect, it } from "vitest"
import {
  extractGradedPrices,
  extractRawPrices,
  scrydexCardToRow,
  visionResultToCatalog,
} from "@/lib/scrydex/adapters"
import { catalogIdToLegacyPokeId, legacyPokeIdToCatalogId, splitCatalogId, toCatalogId } from "@/lib/scrydex/constants"

describe("scrydex id helpers", () => {
  it("builds catalog ids", () => {
    expect(toCatalogId("pokemon", "sv3pt5-173")).toBe("pokemon-sv3pt5-173")
    expect(splitCatalogId("lorcana-ROJ-6")).toEqual({ game: "lorcana", scrydexId: "ROJ-6" })
  })

  it("bridges legacy poke ids", () => {
    expect(legacyPokeIdToCatalogId("poke-sv3pt5-173")).toBe("pokemon-sv3pt5-173")
    expect(catalogIdToLegacyPokeId("pokemon-sv3pt5-173")).toBe("poke-sv3pt5-173")
  })
})

describe("scrydex adapters", () => {
  it("maps card payload to catalog row", () => {
    const row = scrydexCardToRow("pokemon", {
      id: "sv3pt5-173",
      name: "Charizard ex",
      number: "173",
      expansion: { id: "sv3pt5", name: "151" },
      images: [{ type: "front", small: "https://images.scrydex.com/pokemon/sv3pt5-173/small" }],
      variants: [{ name: "normal", prices: [{ type: "raw", condition: "NM", market: 12.5 }] }],
    })

    expect(row.catalog_id).toBe("pokemon-sv3pt5-173")
    expect(row.set_name).toBe("151")
  })

  it("extracts raw and graded prices", () => {
    const variants = [
      {
        name: "normal",
        prices: [
          { type: "raw", condition: "NM", market: 10, currency: "USD" },
          { type: "graded", company: "PSA", grade: "10", market: 250, currency: "USD" },
        ],
      },
    ]

    expect(extractRawPrices("pokemon-sv3pt5-173", variants)).toHaveLength(1)
    expect(extractGradedPrices("pokemon-sv3pt5-173", variants)).toHaveLength(1)
  })

  it("maps vision results", () => {
    const mapped = visionResultToCatalog("pokemon", {
      game: "pokemon",
      id: "sv3pt5-173",
      name: "Charizard ex",
      confidence: 0.92,
      expansion: { id: "sv3pt5", name: "151" },
    })
    expect(mapped?.catalog_id).toBe("pokemon-sv3pt5-173")
  })
})
