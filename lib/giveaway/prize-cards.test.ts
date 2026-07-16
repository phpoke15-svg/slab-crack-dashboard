import { describe, expect, it } from "vitest"
import { prizeCardPriceBand, pricedCatalogToGiveawayCards } from "@/lib/giveaway/prize-cards"
import type { PricedCatalogCard } from "@/lib/trade-binder/priced-catalog"

describe("giveaway prize cards", () => {
  it("builds a symmetric band around the target ARV", () => {
    const band = prizeCardPriceBand(10)
    expect(band.target).toBe(10)
    expect(band.min).toBe(8.5)
    expect(band.max).toBe(11.5)
  })

  it("uses a minimum spread for micro prizes", () => {
    const band = prizeCardPriceBand(1)
    expect(band.min).toBe(0.5)
    expect(band.max).toBe(1.5)
  })

  it("picks catalog cards closest to the target", () => {
    const catalog: PricedCatalogCard[] = [
      {
        id: "a",
        name: "Far card",
        set: "Scarlet & Violet",
        rarity: "Rare",
        image: "/a.png",
        rawPrice: 11,
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
