import { describe, expect, it } from "vitest"
import type { CatalogSearchHit } from "@/lib/db/cards-catalog"
import {
  catalogHitNeedsScrydexRefresh,
  enrichCatalogHitWithScrydex,
} from "@/lib/trade-binder/enrich-catalog-hit"

const baseHit: CatalogSearchHit = {
  id: "poke-base1-4",
  name: "Charizard",
  setName: "Base",
  setId: "base1",
  number: "4/102",
  rarity: "Rare Holo",
  imageUrl: "/placeholder.svg",
  language: "en",
  japaneseName: null,
}

const scrydexHit: CatalogSearchHit = {
  id: "poke-base1-4",
  name: "Charizard",
  setName: "Base Set",
  setId: "base1",
  number: "4/102",
  rarity: "Rare Holo",
  imageUrl: "https://images.scrydex.com/pokemon/base1-4/large",
  language: "en",
  japaneseName: null,
  rawPrice: 420,
  priceSyncedAt: "2026-07-21T00:00:00.000Z",
}

describe("catalogHitNeedsScrydexRefresh", () => {
  it("flags missing prices", () => {
    expect(catalogHitNeedsScrydexRefresh(baseHit)).toBe(true)
  })

  it("flags placeholder images even when priced", () => {
    expect(
      catalogHitNeedsScrydexRefresh({
        ...baseHit,
        rawPrice: 12,
        imageUrl: "/placeholder.svg",
      }),
    ).toBe(true)
  })

  it("skips complete hits", () => {
    expect(catalogHitNeedsScrydexRefresh(scrydexHit)).toBe(false)
  })
})

describe("enrichCatalogHitWithScrydex", () => {
  it("prefers Scrydex image and price over incomplete local rows", () => {
    const enriched = enrichCatalogHitWithScrydex(baseHit, scrydexHit)
    expect(enriched.imageUrl).toBe(scrydexHit.imageUrl)
    expect(enriched.rawPrice).toBe(420)
    expect(enriched.setName).toBe("Base")
  })

  it("keeps local price when already present", () => {
    const enriched = enrichCatalogHitWithScrydex(
      { ...baseHit, rawPrice: 999, imageUrl: "https://images.scrydex.com/pokemon/base1-4/large" },
      scrydexHit,
    )
    expect(enriched.rawPrice).toBe(999)
  })
})
