import { describe, expect, it } from "vitest"
import {
  populationReportKey,
  resolveCardCatalogId,
  resolveSlabPopCount,
} from "@/lib/card-filters/slabpop-population"

describe("slabpop population helpers", () => {
  it("maps legacy poke ids to catalog ids", () => {
    expect(resolveCardCatalogId("poke-sv3-125")).toBe("pokemon-sv3-125")
    expect(resolveCardCatalogId("poke-sv3-125", "sv3-125")).toBe("pokemon-sv3-125")
  })

  it("builds stable population keys", () => {
    expect(populationReportKey("pokemon-sv3-125", "psa", "10")).toBe(
      "pokemon-sv3-125::PSA::10",
    )
  })

  it("prefers Scrydex registry pop over sold comps and market activity", () => {
    expect(
      resolveSlabPopCount({
        scrydexPop: 842,
        soldCompPop: 12,
        marketActivityPop: 4,
      }),
    ).toEqual({ popCount: 842, popSource: "scrydex_pop" })

    expect(
      resolveSlabPopCount({
        scrydexPop: null,
        soldCompPop: 12,
        marketActivityPop: 4,
      }),
    ).toEqual({ popCount: 12, popSource: "sold_comps" })

    expect(
      resolveSlabPopCount({
        scrydexPop: null,
        soldCompPop: null,
        marketActivityPop: 0,
      }),
    ).toBeNull()
  })
})
