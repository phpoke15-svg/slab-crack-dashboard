import { describe, expect, it } from "vitest"
import { filterGradedCards } from "@/lib/card-filters/filter-catalog"
import { MOCK_GRADED_CARDS } from "@/lib/card-filters/mock-catalog"
import {
  POP_MAX,
  popFromPosition,
  positionFromPop,
} from "@/lib/card-filters/pop-scale"

describe("pop-scale", () => {
  it("maps endpoints correctly", () => {
    expect(popFromPosition(0)).toBe(1)
    expect(popFromPosition(1)).toBe(10_000)
  })

  it("gives finer resolution at low pops", () => {
    const lowDelta = popFromPosition(0.1) - popFromPosition(0)
    const highDelta = popFromPosition(0.9) - popFromPosition(0.8)
    expect(lowDelta).toBeLessThan(highDelta)
  })

  it("round-trips position ↔ pop", () => {
    const pops = [1, 50, 127, 500, 1200, 5000, 10_000]
    for (const pop of pops) {
      const position = positionFromPop(pop)
      const roundTrip = popFromPosition(position)
      expect(Math.abs(roundTrip - pop)).toBeLessThanOrEqual(2)
    }
  })
})

describe("filterGradedCards", () => {
  it("filters by pop ceiling, price band, and grade", () => {
    const matches = filterGradedCards(MOCK_GRADED_CARDS, {
      maxPop: 200,
      minPrice: 500,
      maxPrice: 4000,
      grade: "PSA 10",
    })

    expect(matches.length).toBeGreaterThan(0)
    for (const card of matches) {
      expect(card.popCount).toBeLessThanOrEqual(200)
      expect(card.price).toBeGreaterThanOrEqual(500)
      expect(card.price).toBeLessThanOrEqual(4000)
      expect(card.grade).toBe("PSA 10")
    }
  })

  it("returns all cards when filters are wide open", () => {
    const matches = filterGradedCards(MOCK_GRADED_CARDS, {
      maxPop: POP_MAX,
      minPrice: 0,
      maxPrice: 5000,
      grade: "All Grades",
    })
    expect(matches).toHaveLength(MOCK_GRADED_CARDS.length)
  })
})
