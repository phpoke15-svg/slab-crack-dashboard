import { describe, expect, it } from "vitest"
import { normalizePromotionCode, promotionCodeLooksValid } from "@/lib/billing/promotion-code-parse"

describe("promotion code helpers", () => {
  it("trims promotion codes", () => {
    expect(normalizePromotionCode("  collectools  ")).toBe("collectools")
  })

  it("accepts typical promo code lengths", () => {
    expect(promotionCodeLooksValid("collectools")).toBe(true)
    expect(promotionCodeLooksValid("ab")).toBe(false)
    expect(promotionCodeLooksValid("")).toBe(false)
  })
})
