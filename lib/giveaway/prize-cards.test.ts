import { describe, expect, it } from "vitest"
import {
  isWithinPrizeCardBand,
  prizeCardPriceBand,
  pricedCatalogToGiveawayCards,
} from "@/lib/giveaway/prize-cards"
import type { PricedCatalogCard } from "@/lib/trade-binder/priced-catalog"

describe("giveaway prize cards", () => {
  it("builds a strict ±5% band around the target ARV", () => {
    const band = prizeCardPriceBand(10)
    expect(band.target).toBe(10)
    expect(band.min).toBe(9.5)
    expect(band.max).toBe(10.5)
  })

  it("scales the band proportionally for smaller prizes", () => {
    const band = prizeCardPriceBand(7.1)
    expect(band.min).toBeCloseTo(6.745, 2)
    expect(band.max).toBeCloseTo(7.455, 2)
  })

  it("rejects cards outside the ±5% band", () => {
    expect(isWithinPrizeCardBand(10.2, 10)).toBe(true)
    expect(isWithinPrizeCardBand(10.6, 10)).toBe(false)
  })

  it("picks catalog cards closest to the target within the band", () => {
    const catalog: PricedCatalogCard[] = [
      {
        id: "a",
        name: "Edge card",
        set: "Scarlet & Violet",
        rarity: "Rare",
        image: "/a.png",
        rawPrice: 10.5,
      },
      {
        id: "b",
        name: "Near card",
        set: "Scarlet & Violet",
        rarity: "Rare",
        image: "/b.png",
        rawPrice: 10.2,
      },
      {
        id: "c",
        name: "Out of band",
        set: "Scarlet & Violet",
        rarity: "Rare",
        image: "/c.png",
        rawPrice: 50,
      },
    ]

    const { cards } = pricedCatalogToGiveawayCards(catalog, 10, 5)
    expect(cards.map((card) => card.id)).toEqual(["b", "a"])
  })
})
