import { describe, expect, it } from "vitest"
import { cardNumberMatches } from "@/lib/trade-binder/pokemon-tcg"

describe("cardNumberMatches", () => {
  it("matches collector numbers with set totals", () => {
    expect(cardNumberMatches("41/130", "41")).toBe(true)
    expect(cardNumberMatches("041/130", "41")).toBe(true)
    expect(cardNumberMatches("4/102", "41")).toBe(false)
  })
})
