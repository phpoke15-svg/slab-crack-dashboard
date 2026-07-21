import { describe, expect, it } from "vitest"
import type { PokeMatchCardDetailPayload } from "@/lib/trade-binder/pokematch-card-full"

describe("PokeMatch card detail payload", () => {
  it("excludes graded-only fields from the public shape", () => {
    const payload: PokeMatchCardDetailPayload = {
      id: "poke-sv1-1",
      name: "Bulbasaur",
      setName: "Scarlet & Violet",
      cardNumber: "001",
      imageUrl: "/placeholder.svg",
      rawPrice: 1.5,
      hasPricing: true,
      catalogId: "pokemon-sv1-1",
      scrydexId: "sv1-1",
      game: "pokemon",
      priceUpdatedAt: null,
      priceSource: "scrydex",
      marketInsight: "Raw NM only",
      recentRawSales: [],
    }

    expect(payload).not.toHaveProperty("gradeQuotes")
    expect(payload).not.toHaveProperty("population")
    expect(payload).not.toHaveProperty("slabPrice")
    expect(Object.keys(payload).sort()).toEqual(
      [
        "catalogId",
        "cardNumber",
        "game",
        "hasPricing",
        "id",
        "imageUrl",
        "marketInsight",
        "name",
        "priceSource",
        "priceUpdatedAt",
        "rawPrice",
        "recentRawSales",
        "scrydexId",
        "setName",
      ].sort(),
    )
  })
})
