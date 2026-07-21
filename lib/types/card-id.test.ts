import { describe, expect, it } from "vitest"
import {
  bareTcgIdFromCatalogId,
  inferCardLanguageFromTcgId,
  isLegacyPriceChartingCardId,
  legacyPcIdFromCardId,
  toPokemonCatalogId,
} from "@/lib/types/card-id"

describe("card-id helpers", () => {
  it("detects legacy pc ids", () => {
    expect(isLegacyPriceChartingCardId("pc-12345")).toBe(true)
    expect(isLegacyPriceChartingCardId("poke-mep-41")).toBe(false)
  })

  it("extracts legacy pc id segment", () => {
    expect(legacyPcIdFromCardId("pc-99887")).toBe("99887")
    expect(legacyPcIdFromCardId("poke-sv3pt5-173")).toBeNull()
  })

  it("builds poke catalog ids", () => {
    expect(toPokemonCatalogId("mep-41")).toBe("poke-mep-41")
    expect(toPokemonCatalogId("poke-mep-41")).toBe("poke-mep-41")
  })

  it("parses bare tcg id from catalog id", () => {
    expect(bareTcgIdFromCatalogId("poke-sv3pt5-173")).toBe("sv3pt5-173")
    expect(bareTcgIdFromCatalogId("pc-1")).toBeUndefined()
  })

  it("infers japanese language from tcg id hints", () => {
    expect(inferCardLanguageFromTcgId("sv2a-025")).toBe("en")
    expect(inferCardLanguageFromTcgId("s-p-123")).toBe("ja")
  })
})
