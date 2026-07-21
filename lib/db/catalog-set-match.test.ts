import { describe, expect, it } from "vitest"
import { catalogRowMatchesSetHint } from "@/lib/db/catalog-set-match"

describe("catalogRowMatchesSetHint", () => {
  it("matches prismatic shorthand to sv8pt5 ids", () => {
    expect(
      catalogRowMatchesSetHint(
        {
          set_name: "Prismatic Evolutions",
          set_id: "sv8pt5",
          id: "poke-sv8pt5-196",
        },
        "prismatic",
      ),
    ).toBe(true)
  })

  it("matches numeric 151 shorthand", () => {
    expect(
      catalogRowMatchesSetHint(
        {
          set_name: "Scarlet & Violet: 151",
          set_id: "sv3pt5",
          id: "poke-sv3pt5-173",
        },
        "151",
      ),
    ).toBe(true)
  })

  it("rejects wrong set for hint", () => {
    expect(
      catalogRowMatchesSetHint(
        {
          set_name: "Base",
          set_id: "base1",
          id: "poke-base1-4",
        },
        "prismatic",
      ),
    ).toBe(false)
  })
})
