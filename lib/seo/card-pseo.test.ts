import { describe, expect, it } from "vitest"
import type { CatalogSearchHit } from "@/lib/db/cards-catalog"
import {
  buildCardPseoMetadata,
  buildCardProductJsonLd,
  buildCardSeoDescription,
  buildCardSeoTitle,
} from "@/lib/seo/card-pseo"

const sampleCard: CatalogSearchHit = {
  id: "poke-base1-4",
  name: "Charizard",
  setName: "Base Set",
  setId: "base1",
  number: "4/102",
  rarity: "Legendary",
  imageUrl: "https://images.pokemontcg.io/base1/4_hires.png",
  language: "en",
  japaneseName: null,
}

describe("buildCardSeoTitle", () => {
  it("formats the title tag", () => {
    expect(buildCardSeoTitle(sampleCard)).toBe(
      "Charizard #4/102 (Base Set) Value & Price Guide - CollecTools",
    )
  })
})

describe("buildCardSeoDescription", () => {
  it("mentions raw and graded values", () => {
    expect(buildCardSeoDescription(sampleCard)).toContain("Charizard")
    expect(buildCardSeoDescription(sampleCard)).toContain("Base Set")
  })
})

describe("buildCardProductJsonLd", () => {
  it("emits Product schema with AggregateOffer", () => {
    const json = buildCardProductJsonLd({
      card: sampleCard,
      price: {
        card_id: sampleCard.id,
        raw_price: 250,
        psa7_price: 200,
        psa8_price: 220,
        psa9_price: 240,
        psa10_price: 500,
        price_source: "pricecharting",
        synced_at: "2026-07-17T00:00:00.000Z",
        sync_error: null,
        card_name: "Charizard",
        card_set: "Base Set",
        card_number: "4/102",
      },
      soldCompCount: 12,
      setSlug: "base-set",
      cardSlug: "charizard-4",
    })

    expect(json["@type"]).toBe("Product")
    expect(json.offers).toMatchObject({
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "250.00",
      highPrice: "500.00",
      offerCount: 12,
    })
  })
})

describe("buildCardPseoMetadata", () => {
  it("sets openGraph image from card art", () => {
    const meta = buildCardPseoMetadata({
      card: sampleCard,
      price: null,
      soldCompCount: 0,
      setSlug: "base-set",
      cardSlug: "charizard-4",
    })

    expect(meta.openGraph?.images).toEqual([
      { url: sampleCard.imageUrl, alt: "Charizard" },
    ])
  })
})
