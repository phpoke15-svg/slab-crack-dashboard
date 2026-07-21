import { describe, expect, it } from "vitest"
import {
  isModernTrendingPokemonSet,
  isVintagePokemonSetName,
  rankPopularHits,
  recencyBoost,
  scorePopularCard,
} from "@/lib/tcg-research/popular-cards"
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

describe("isVintagePokemonSetName", () => {
  it("flags Legendary Collection as vintage", () => {
    expect(isVintagePokemonSetName("Legendary Collection")).toBe(true)
  })
})

describe("isModernTrendingPokemonSet", () => {
  it("accepts recent release dates", () => {
    expect(
      isModernTrendingPokemonSet({
        setId: "sv3pt5",
        setName: "151",
        releaseDate: "2023-09-22",
      }),
    ).toBe(true)
  })

  it("rejects Legendary Collection even with missing release date", () => {
    expect(
      isModernTrendingPokemonSet({
        setId: "base6",
        setName: "Legendary Collection",
        releaseDate: null,
      }),
    ).toBe(false)
  })

  it("accepts modern set id prefixes when release date is missing", () => {
    expect(
      isModernTrendingPokemonSet({
        setId: "sv4",
        setName: "Paradox Rift",
        releaseDate: null,
      }),
    ).toBe(true)
  })
})

describe("recencyBoost", () => {
  it("gives newer sets a higher boost", () => {
    const now = new Date("2026-07-21T00:00:00.000Z")
    const newer = recencyBoost("2025-01-01", now)
    const older = recencyBoost("2022-01-01", now)
    expect(newer).toBeGreaterThan(older)
  })
})

describe("scorePopularCard", () => {
  it("weights activity above raw price", () => {
    const lowActivityHighPrice = scorePopularCard({ activityHits: 1, rawPrice: 500, psa10Price: 600 })
    const highActivityLowPrice = scorePopularCard({ activityHits: 10, rawPrice: 20, psa10Price: 30 })
    expect(highActivityLowPrice).toBeGreaterThan(lowActivityHighPrice)
  })

  it("adds recency bonus for modern release dates", () => {
    const recent = scorePopularCard({
      activityHits: 0,
      rawPrice: 50,
      psa10Price: 60,
      releaseDate: "2025-03-01",
    })
    const stale = scorePopularCard({
      activityHits: 0,
      rawPrice: 50,
      psa10Price: 60,
      releaseDate: "2021-03-01",
    })
    expect(recent).toBeGreaterThan(stale)
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
