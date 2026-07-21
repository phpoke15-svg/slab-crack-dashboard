import { describe, expect, it } from "vitest"
import { isCachedPriceFromActiveProvider, getActivePriceProvider } from "@/lib/pricing/provider"

describe("isCachedPriceFromActiveProvider", () => {
  it("accepts matching tcggo cache when tcggo is active", () => {
    expect(isCachedPriceFromActiveProvider({ price_source: "tcggo" }, "tcggo")).toBe(true)
  })

  it("rejects pricecharting cache when tcggo is active", () => {
    expect(isCachedPriceFromActiveProvider({ price_source: "pricecharting" }, "tcggo")).toBe(false)
  })

  it("treats missing source as tcggo", () => {
    expect(isCachedPriceFromActiveProvider({ price_source: "" }, "tcggo")).toBe(true)
    expect(isCachedPriceFromActiveProvider({ price_source: "" }, null)).toBe(false)
  })

  it("returns false when provider is null", () => {
    expect(isCachedPriceFromActiveProvider({ price_source: "tcggo" }, null)).toBe(false)
  })
})

describe("getActivePriceProvider", () => {
  it("requires RAPIDAPI_POKEMON_TCG_KEY", () => {
    const prev = process.env.RAPIDAPI_POKEMON_TCG_KEY
    delete process.env.RAPIDAPI_POKEMON_TCG_KEY
    expect(getActivePriceProvider()).toBeNull()
    if (prev) process.env.RAPIDAPI_POKEMON_TCG_KEY = prev
  })
})
