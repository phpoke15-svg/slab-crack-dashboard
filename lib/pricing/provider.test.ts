import { describe, expect, it } from "vitest"
import { isCachedPriceFromActiveProvider } from "@/lib/pricing/provider"

describe("isCachedPriceFromActiveProvider", () => {
  it("accepts matching tcggo cache when tcggo is active", () => {
    expect(isCachedPriceFromActiveProvider({ price_source: "tcggo" }, "tcggo")).toBe(true)
  })

  it("rejects pricecharting cache when tcggo is active", () => {
    expect(isCachedPriceFromActiveProvider({ price_source: "pricecharting" }, "tcggo")).toBe(false)
  })

  it("treats missing source as pricecharting", () => {
    expect(isCachedPriceFromActiveProvider({ price_source: "" }, "tcggo")).toBe(false)
    expect(isCachedPriceFromActiveProvider({ price_source: "" }, "pricecharting")).toBe(true)
  })

  it("returns false when provider is null", () => {
    expect(isCachedPriceFromActiveProvider({ price_source: "tcggo" }, null)).toBe(false)
  })
})
