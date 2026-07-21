import { describe, expect, it } from "vitest"
import {
  catalogRowMatchesQuery,
  catalogSearchMinLength,
  normalizeSearchCleanName,
  rankCatalogSearchHits,
  sanitizeCatalogSearchToken,
} from "@/lib/db/catalog-search-local"
import type { CatalogCardRow, CatalogSearchHit } from "@/lib/db/cards-catalog"

const sampleRow: CatalogCardRow = {
  id: "poke-base1-4",
  name: "Charizard",
  japanese_name: null,
  set_name: "Base",
  set_id: "base1",
  number: "4/102",
  rarity: "Rare Holo",
  image_url: "",
}

describe("catalogSearchMinLength", () => {
  it("allows number-only queries", () => {
    expect(catalogSearchMinLength("4")).toBe(true)
    expect(catalogSearchMinLength("025")).toBe(true)
  })

  it("requires two characters for text queries", () => {
    expect(catalogSearchMinLength("a")).toBe(false)
    expect(catalogSearchMinLength("pi")).toBe(true)
  })

  it("allows set shorthand browse queries", () => {
    expect(catalogSearchMinLength("151")).toBe(true)
    expect(catalogSearchMinLength("151 173")).toBe(true)
  })
})

describe("catalogRowMatchesQuery", () => {
  it("matches name and number tokens together", () => {
    expect(catalogRowMatchesQuery(sampleRow, "charizard 4")).toBe(true)
    expect(catalogRowMatchesQuery(sampleRow, "charizard 99")).toBe(false)
  })

  it("matches name and set tokens together", () => {
    expect(catalogRowMatchesQuery(sampleRow, "charizard base")).toBe(true)
  })
})

describe("rankCatalogSearchHits", () => {
  const hits: CatalogSearchHit[] = [
    {
      id: "poke-base1-4",
      name: "Charizard",
      setName: "Base",
      setId: "base1",
      number: "4",
      rarity: "Legendary",
      imageUrl: "",
      language: "en",
      japaneseName: null,
    },
    {
      id: "poke-base1-46",
      name: "Charmander",
      setName: "Base",
      setId: "base1",
      number: "46",
      rarity: "Common",
      imageUrl: "",
      language: "en",
      japaneseName: null,
    },
  ]

  it("prioritizes exact name + number matches", () => {
    const ranked = rankCatalogSearchHits(hits, "charizard 4", 2)
    expect(ranked[0]?.id).toBe("poke-base1-4")
  })
})

describe("sanitizeCatalogSearchToken", () => {
  it("strips wildcard characters", () => {
    expect(sanitizeCatalogSearchToken("char%izard_")).toBe("charizard")
  })
})

describe("normalizeSearchCleanName", () => {
  it("lowercases and strips special characters", () => {
    expect(normalizeSearchCleanName("Charizard (Holo)!")).toBe("charizard holo")
    expect(normalizeSearchCleanName("  Pikachu-VMAX  ")).toBe("pikachu vmax")
  })

  it("preserves digits and spaces for set-style queries", () => {
    expect(normalizeSearchCleanName("151 173")).toBe("151 173")
  })
})
