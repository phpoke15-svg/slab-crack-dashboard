import { describe, expect, it } from "vitest"
import { promoCardMeta, promoCardMetaByTcgId } from "@/lib/trade-binder/promo-card-meta"

describe("promoCardMeta", () => {
  it("includes Chimchar mep-41 with tcgplayer id", () => {
    const meta = promoCardMeta("poke-mep-41")
    expect(meta).toMatchObject({
      id: "poke-mep-41",
      name: "Chimchar",
      setId: "mep",
      number: "41",
      tcgplayerId: 684465,
    })
  })

  it("resolves by tcg id", () => {
    expect(promoCardMetaByTcgId("mep-41")?.id).toBe("poke-mep-41")
  })
})
