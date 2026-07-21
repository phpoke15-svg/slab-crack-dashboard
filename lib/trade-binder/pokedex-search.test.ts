import { describe, expect, it } from "vitest"
import { parseBinderSearchTokens } from "@/lib/trade-binder/pokemon-tcg"
import { pokedexSpeciesName } from "@/lib/trade-binder/pokedex-search"

describe("parseBinderSearchTokens pokedex disambiguation", () => {
  it("tags set+number queries with pokedexNumber for shorthand sets", () => {
    const tokens = parseBinderSearchTokens("prismatic 196")
    expect(tokens.setHint).toBe("prismatic")
    expect(tokens.number).toBe("196")
    expect(tokens.pokedexNumber).toBe(196)
  })

  it("resolves espeon from pokedex 196", () => {
    expect(pokedexSpeciesName(196)).toBe("espeon")
  })
})
