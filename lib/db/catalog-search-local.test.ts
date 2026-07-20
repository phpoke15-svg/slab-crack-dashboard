import { describe, expect, it } from "vitest"
import {
  catalogRowMatchesQuery,
  catalogSearchMinLength,
  sanitizeCatalogSearchToken,
} from "@/lib/db/catalog-search-local"
import type { CatalogCardRow } from "@/lib/db/cards-catalog"
import { rankCatalogSearchHits } from "@/lib/db/catalog-search-local"
import type { CatalogSearchHit } from "@/lib/db/cards-catalog"

const sampleRow: CatalogCardRow = {
  id: "poke-base1-4",
  name: "Charizard",
  japanese_name: null,
  set_name: "Base",
  set_id: "base1",
  number: "4/102",
  rarity: "Rare Holo",
  image_url: "",
  language: "en",
  updated_at: "2026-01-01T00:00:00.000Z",
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
