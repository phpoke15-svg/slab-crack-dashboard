import { describe, expect, it } from "vitest"
import { promoCardMeta } from "@/lib/trade-binder/promo-card-meta"

describe("lazy price history prerequisites", () => {
  it("resolves promo metadata for on-demand history lookup", () => {
    expect(promoCardMeta("poke-mep-41")?.tcgplayerId).toBe(684465)
  })
})
