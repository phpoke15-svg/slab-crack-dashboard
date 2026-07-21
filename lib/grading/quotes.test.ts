import { describe, expect, it } from "vitest"
import {
  buildSlabQuotesForCompany,
  gradedRowsFromScrydexBundle,
  pickGradedPrice,
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
      grade: "9",
    })
  })

  it("formats slab labels", () => {
    expect(formatSlabLabel({ company: "TAG", grade: "10" })).toBe("TAG 10")
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
})
