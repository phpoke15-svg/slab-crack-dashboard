import { describe, expect, it } from "vitest"
import { resolveRepairCatalogIds } from "@/lib/scrydex/repair-stale-prices"

describe("resolveRepairCatalogIds", () => {
  it("includes known promo cards by default", () => {
    const ids = resolveRepairCatalogIds({ maxCards: 10 })
    expect(ids).toContain("pokemon-mep-41")
  })

  it("merges explicit ids with promos", () => {
    const ids = resolveRepairCatalogIds({
      ids: ["poke-base1-4", "mep-41"],
      maxCards: 10,
    })
    expect(ids).toContain("pokemon-mep-41")
    expect(ids).toContain("pokemon-base1-4")
  })

  it("can skip promos when includePromos is false", () => {
    const ids = resolveRepairCatalogIds({
      ids: ["poke-base1-4"],
      includePromos: false,
      maxCards: 10,
    })
    expect(ids).toEqual(["pokemon-base1-4"])
  })
})
