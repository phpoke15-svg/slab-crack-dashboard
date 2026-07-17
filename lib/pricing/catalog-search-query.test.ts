import { describe, expect, it } from "vitest"
import {
  buildCatalogPriceSearchQuery,
  formatCatalogCardNumber,
  formatCatalogCardNumberWithTotal,
} from "@/lib/pricing/catalog-search-query"

describe("formatCatalogCardNumber", () => {
  it("prefixes card numbers with #", () => {
    expect(formatCatalogCardNumber("4/102")).toBe("#4/102")
    expect(formatCatalogCardNumber("#4/102")).toBe("#4/102")
  })
})

describe("formatCatalogCardNumberWithTotal", () => {
  it("appends printed total when missing", () => {
    expect(formatCatalogCardNumberWithTotal("4", 102)).toBe("4/102")
    expect(formatCatalogCardNumberWithTotal("4/102", 102)).toBe("4/102")
  })
})

describe("buildCatalogPriceSearchQuery", () => {
  it("joins name, set, and formatted number", () => {
    expect(buildCatalogPriceSearchQuery("Charizard", "Base Set", "4/102")).toBe(
      "Charizard Base Set #4/102",
    )
  })

  it("strips rarity suffixes from the card name", () => {
    expect(buildCatalogPriceSearchQuery("Charizard (Rare Holo)", "Base Set", "4/102")).toBe(
      "Charizard Base Set #4/102",
    )
  })
})
