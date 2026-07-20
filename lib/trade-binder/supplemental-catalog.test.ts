import { describe, expect, it } from "vitest"
import { searchSupplementalCatalog } from "@/lib/trade-binder/supplemental-catalog"
import { resolveBinderSetIdHint } from "@/lib/trade-binder/pokemon-tcg"

describe("searchSupplementalCatalog", () => {
  it("finds Chimchar 41 from Mega Evolution promos", () => {
    const hits = searchSupplementalCatalog("chimchar 41", 5)
    expect(hits).toHaveLength(1)
    expect(hits[0]?.id).toBe("poke-mep-41")
    expect(hits[0]?.name).toBe("Chimchar")
    expect(hits[0]?.number).toBe("41")
  })

  it("finds Chimchar 41 via mep set shorthand", () => {
    const hits = searchSupplementalCatalog("mep 41", 5)
    expect(hits).toHaveLength(1)
    expect(hits[0]?.id).toBe("poke-mep-41")
  })
})

describe("resolveBinderSetIdHint", () => {
  it("maps mep promo shorthand", () => {
    expect(resolveBinderSetIdHint("mep")).toBe("mep")
    expect(resolveBinderSetIdHint("megaevolution")).toBe("mep")
  })
})
