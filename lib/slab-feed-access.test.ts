import { describe, expect, it } from "vitest"
import {
  FREE_SLAB_FEED_LIMIT,
  limitSlabFeed,
  pickMidDeficitCards,
  pickTopRankedCards,
} from "@/lib/slab-feed-access"

describe("pickMidDeficitCards", () => {
  it("returns mid-window cards, not the top deficits", () => {
    const cards = Array.from({ length: 40 }, (_, i) => ({
      id: String(i),
      deficit: 40 - i,
      hasPricing: true as const,
    }))
    const picked = pickMidDeficitCards(cards, FREE_SLAB_FEED_LIMIT)
    expect(picked).toHaveLength(10)
    expect(picked.some((c) => c.deficit === 40)).toBe(false)
    const deficits = picked.map((c) => c.deficit)
    expect(Math.max(...deficits) - Math.min(...deficits)).toBe(9)
  })

  it("returns all cards when fewer than the limit", () => {
    const cards = [
      { deficit: 12, hasPricing: true },
      { deficit: 5, hasPricing: true },
    ]
    expect(pickMidDeficitCards(cards, 10)).toHaveLength(2)
  })
})

describe("pickTopRankedCards", () => {
  it("returns the highest-scoring cards first", () => {
    const cards = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      score: i,
      hasPricing: true as const,
    }))
    const top = pickTopRankedCards(cards, (c) => c.score, 5)
    expect(top.map((c) => c.score)).toEqual([19, 18, 17, 16, 15])
  })
})

describe("limitSlabFeed", () => {
  it("maps preview / top100 / full access", () => {
    const cards = Array.from({ length: 120 }, (_, i) => ({
      id: String(i),
      score: 120 - i,
      hasPricing: true as const,
    }))
    expect(limitSlabFeed(cards, "preview", (c) => c.score)).toHaveLength(10)
    expect(limitSlabFeed(cards, "top100", (c) => c.score)).toHaveLength(100)
    expect(limitSlabFeed(cards, "full", (c) => c.score)).toHaveLength(120)
  })
})
