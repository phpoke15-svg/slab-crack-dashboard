import { describe, expect, it } from "vitest"
import { rankPopularHits, scorePopularCard } from "@/lib/tcg-research/popular-cards"
import type { CardSearchHit } from "@/lib/card-lookup"

function hit(id: string, price: number): CardSearchHit {
  return {
    id,
    pokemonTcgId: id,
    cardName: id,
    setName: "Set",
    cardNumber: "1",
    imageUrl: "/placeholder.svg",
    rarity: null,
    rawPrice: price,
  }
}

describe("scorePopularCard", () => {
  it("weights activity above raw price", () => {
    const lowActivityHighPrice = scorePopularCard({ activityHits: 1, rawPrice: 500, psa10Price: 600 })
    const highActivityLowPrice = scorePopularCard({ activityHits: 10, rawPrice: 20, psa10Price: 30 })
    expect(highActivityLowPrice).toBeGreaterThan(lowActivityHighPrice)
  })
})

describe("rankPopularHits", () => {
  it("returns highest scores first", () => {
    const ranked = rankPopularHits(
      [
        { hit: hit("a", 10), score: 100 },
        { hit: hit("b", 50), score: 500 },
        { hit: hit("c", 30), score: 300 },
      ],
      2,
    )

    expect(ranked.map((row) => row.id)).toEqual(["b", "c"])
  })
})
