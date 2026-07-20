import { describe, expect, it } from "vitest"
import { resolveHistoryCardId } from "@/lib/pricing/history-card-id"

describe("resolveHistoryCardId", () => {
  it("keeps poke- ids", () => {
    expect(resolveHistoryCardId("poke-mep-41")).toBe("poke-mep-41")
  })

  it("maps pokemon tcg id param to poke- prefix", () => {
    expect(resolveHistoryCardId("pc-12345", "mep-41")).toBe("poke-mep-41")
    expect(resolveHistoryCardId("pc-12345", "poke-mep-41")).toBe("poke-mep-41")
  })

  it("ignores pc- pokemonTcgId values", () => {
    expect(resolveHistoryCardId("pc-12345", "pc-12345")).toBe("pc-12345")
  })
})
