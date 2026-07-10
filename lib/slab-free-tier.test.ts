import { describe, expect, it } from "vitest"
import { FREE_SLABCRACK_LIMIT, pickMidDeficitCards } from "@/lib/slab-free-tier"

describe("pickMidDeficitCards", () => {
  it("returns mid-window cards, not the top deficits", () => {
    const cards = Array.from({ length: 40 }, (_, i) => ({
      id: String(i),
      deficit: 40 - i,
      hasPricing: true as const,
    }))
    const picked = pickMidDeficitCards(cards, FREE_SLABCRACK_LIMIT)
    expect(picked).toHaveLength(10)
    // Top deficit is 40; mid window should not include it
    expect(picked.some((c) => c.deficit === 40)).toBe(false)
    // Should be contiguous mid ranks
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
