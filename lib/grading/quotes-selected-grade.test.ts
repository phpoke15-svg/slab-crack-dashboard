import { describe, expect, it } from "vitest"
import { resolveSelectedGradeDisplayPrice } from "@/lib/grading/quotes"
import { normalizeCardEntry } from "@/lib/slab-data"

describe("resolveSelectedGradeDisplayPrice", () => {
  const card = normalizeCardEntry({
    id: "poke-test-1",
    pokemonTcgId: "test-1",
    cardName: "Test Card",
    setName: "Test Set",
    cardNumber: "1",
    imageUrl: "/placeholder.svg",
    rawPrice: 100,
    slabGrade: 10,
    slabPrice: 0,
    deficit: 0,
    percentageSavings: 0,
    hasPricing: true,
    marketInsight: "test",
  })

  it("returns direct PSA 9 price for selected grade", () => {
    const result = resolveSelectedGradeDisplayPrice(
      [{ company: "PSA", grade: "9", marketPrice: 250 }],
      card,
      { company: "PSA", grade: "9" },
    )
    expect(result).toEqual({ price: 250, estimated: false })
  })

  it("estimates PSA 10 from lower grades", () => {
    const result = resolveSelectedGradeDisplayPrice(
      [{ company: "PSA", grade: "9", marketPrice: 180 }],
      card,
      { company: "PSA", grade: "10" },
    )
    expect(result.price).toBeGreaterThan(0)
    expect(result.estimated).toBe(true)
  })
})
