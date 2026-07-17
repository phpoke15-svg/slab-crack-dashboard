import { describe, expect, it } from "vitest"
import {
  catalogHitToBinderCard,
  catalogHitToCardSearchHit,
  catalogPokemonTcgId,
  type CatalogSearchHit,
} from "@/lib/db/cards-catalog"

const sampleHit: CatalogSearchHit = {
  id: "poke-base1-4",
  name: "Charizard",
  setName: "Base",
  setId: "base1",
  number: "4",
  rarity: "Legendary",
  imageUrl: "https://images.pokemontcg.io/base1/4_hires.png",
  language: "en",
  japaneseName: null,
  rawPrice: 250,
}

describe("catalogPokemonTcgId", () => {
  it("strips poke- prefix", () => {
    expect(catalogPokemonTcgId("poke-base1-4")).toBe("base1-4")
    expect(catalogPokemonTcgId("base1-4")).toBe("base1-4")
  })
})

describe("catalogHitToCardSearchHit", () => {
  it("maps catalog hits to SlabCrack search shape", () => {
    expect(catalogHitToCardSearchHit(sampleHit)).toEqual({
      id: "poke-base1-4",
      pokemonTcgId: "base1-4",
      cardName: "Charizard",
      setName: "Base",
      cardNumber: "4",
      imageUrl: sampleHit.imageUrl,
      rarity: "Legendary",
    })
  })
})

describe("catalogHitToBinderCard", () => {
  it("maps catalog hits to binder search shape", () => {
    const card = catalogHitToBinderCard(sampleHit)
    expect(card.id).toBe("poke-base1-4")
    expect(card.name).toBe("Charizard")
    expect(card.set).toBe("Base")
    expect(card.cardNumber).toBe("4")
    expect(card.rawPrice).toBe(250)
  })
})
