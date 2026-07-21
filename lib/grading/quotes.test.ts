import { describe, expect, it } from "vitest"
import {
  buildSlabQuotesForCompany,
  gradedRowsFromScrydexBundle,
  mergeGradedPriceRows,
  pickGradedPrice,
  resolveGradedPricesForCard,
  resolvePsa10DisplayPrice,
} from "@/lib/grading/quotes"
import {
  coerceSlabGradeRef,
  formatSlabLabel,
  gradesForCompany,
  normalizeGradingCompany,
} from "@/lib/grading/types"

describe("grading types", () => {
  it("normalizes company aliases", () => {
    expect(normalizeGradingCompany("psa")).toBe("PSA")
    expect(normalizeGradingCompany("unknown")).toBe("PSA")
  })

  it("merges available grades from Scrydex rows", () => {
    const grades = gradesForCompany("BGS", [
      { company: "BGS", grade: "9.5" },
      { company: "BGS", grade: "8" },
    ])
    expect(grades).toContain("9.5")
    expect(grades).toContain("8")
  })

  it("coerces invalid grade to company default", () => {
    expect(coerceSlabGradeRef("CGC", "99", [{ company: "CGC", grade: "10" }])).toEqual({
      company: "CGC",
      grade: "10",
    })
  })

  it("formats slab labels", () => {
    expect(formatSlabLabel({ company: "TAG", grade: "10" })).toBe("TAG 10")
  })

  it("lists PSA grades from 10 down to 1", () => {
    expect(gradesForCompany("PSA")).toEqual([
      "10",
      "9",
      "8",
      "7",
      "6",
      "5",
      "4",
      "3",
      "2",
      "1",
    ])
  })

  it("sorts BGS grades highest first", () => {
    const grades = gradesForCompany("BGS")
    expect(grades.indexOf("10")).toBeLessThan(grades.indexOf("9"))
    expect(grades.indexOf("9")).toBeLessThan(grades.indexOf("7"))
  })
})

describe("grading quotes", () => {
  const rows = gradedRowsFromScrydexBundle([
    { company: "PSA", grade: "9", market_price: 120, variant: "normal" },
    { company: "BGS", grade: "9.5", market_price: 180, variant: "normal" },
  ])

  it("builds arbitrage quotes for a company", () => {
    const quotes = buildSlabQuotesForCompany(150, rows, "PSA")
    const psa9 = quotes.find((quote) => quote.grade === "9")
    expect(psa9?.isArbitrage).toBe(true)
    expect(psa9?.deficit).toBe(30)
  })

  it("picks graded price by company and grade", () => {
    expect(pickGradedPrice(rows, { company: "BGS", grade: "9.5" })).toBe(180)
  })

  it("merges Scrydex rows with card-level fallbacks", () => {
    const merged = mergeGradedPriceRows(
      [{ company: "PSA", grade: "9", marketPrice: 120 }],
      [{ company: "PSA", grade: "10", marketPrice: 250 }],
    )
    expect(pickGradedPrice(merged, { company: "PSA", grade: "9" })).toBe(120)
    expect(pickGradedPrice(merged, { company: "PSA", grade: "10" })).toBe(250)
  })

  it("fills missing Scrydex grades from mock card quotes", () => {
    const resolved = resolveGradedPricesForCard(
      [{ company: "PSA", grade: "9", marketPrice: 120 }],
      {
        id: "poke-test-1",
        cardName: "Test",
        setName: "Set",
        cardNumber: "1",
        imageUrl: "/placeholder.svg",
        rawPrice: 50,
        slabGrade: 10,
        slabPrice: 300,
        gradeQuotes: [{ grade: 10, slabPrice: 300, deficit: 0, percentageSavings: 0, isArbitrage: false }],
        hasPricing: true,
        marketInsight: "",
      },
    )

    expect(pickGradedPrice(resolved, { company: "PSA", grade: "9" })).toBe(120)
    expect(pickGradedPrice(resolved, { company: "PSA", grade: "10" })).toBe(300)
  })

  it("estimates PSA 10 from lower Scrydex grades", () => {
    const estimated = resolvePsa10DisplayPrice(
      [{ company: "PSA", grade: "9", marketPrice: 45 }],
      {
        id: "poke-test-1",
        cardName: "Test",
        setName: "Set",
        cardNumber: "1",
        imageUrl: "/placeholder.svg",
        rawPrice: 10,
        slabGrade: 10,
        slabPrice: 0,
        hasPricing: true,
        marketInsight: "",
      },
    )

    expect(estimated.estimated).toBe(true)
    expect(estimated.price).toBe(100)
  })
})
