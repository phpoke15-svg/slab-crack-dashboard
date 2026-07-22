import { describe, expect, it } from "vitest"
import {
  parsePriceHistoryType,
  resolvePriceHistoryDateRange,
} from "@/lib/scrydex/price-history-type"

describe("price-history-type", () => {
  it("parses type query values", () => {
    expect(parsePriceHistoryType(null)).toBe("both")
    expect(parsePriceHistoryType("raw")).toBe("raw")
    expect(parsePriceHistoryType("graded")).toBe("graded")
    expect(parsePriceHistoryType("invalid")).toBe("both")
  })

  it("resolves date ranges from presets and explicit params", () => {
    const explicit = resolvePriceHistoryDateRange({
      days: 30,
      full: false,
      fromParam: "2015-01-01",
      toParam: "2026-07-21",
    })
    expect(explicit).toEqual({ from: "2015-01-01", to: "2026-07-21" })

    const full = resolvePriceHistoryDateRange({ days: 0, full: true })
    expect(full.from).toBe("2015-01-01")
    expect(full.to.length).toBe(10)
  })
})
