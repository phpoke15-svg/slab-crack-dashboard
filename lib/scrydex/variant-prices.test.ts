import { describe, expect, it } from "vitest"
import { gradedRowsFromScrydexBundle } from "@/lib/grading/quotes"
import {
  pickPsaGradeFromRows,
  pickPreferredGradedRows,
  pickPreferredRawRow,
} from "@/lib/scrydex/variant-prices"

describe("variant price selection", () => {
  it("prefers holofoil graded prices when normal rows are missing", () => {
    const rows = [
      { variant: "holofoil", company: "PSA", grade: "10", market_price: 2400 },
      { variant: "holofoil", company: "PSA", grade: "9", market_price: 900 },
    ]

    expect(pickPsaGradeFromRows(rows, "10")).toBe(2400)
    expect(pickPreferredGradedRows(rows)).toHaveLength(2)
    expect(gradedRowsFromScrydexBundle(rows)).toEqual([
      { company: "PSA", grade: "10", marketPrice: 2400 },
      { company: "PSA", grade: "9", marketPrice: 900 },
    ])
  })

  it("prefers normal over holofoil when both exist", () => {
    const rows = [
      { variant: "holofoil", company: "PSA", grade: "10", market_price: 2400 },
      { variant: "normal", company: "PSA", grade: "10", market_price: 2300 },
    ]

    expect(pickPsaGradeFromRows(rows, "10")).toBe(2300)
  })

  it("falls back to holofoil raw when normal raw is missing", () => {
    const rows = [{ variant: "holofoil", condition: "NM", market_price: 878.94 }]

    expect(pickPreferredRawRow(rows)?.market_price).toBe(878.94)
  })
})
