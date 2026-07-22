import { describe, expect, it } from "vitest"
import {
  APPLE_IAP_PRODUCTS,
  appleProductIdFromPriceKey,
  planFromAppleProductId,
  priceKeyFromAppleProductId,
} from "@/lib/billing/apple-iap"

describe("apple-iap product mapping", () => {
  it("maps price keys to App Store product IDs", () => {
    expect(appleProductIdFromPriceKey("pro_month")).toBe("collectools_pro_monthly")
    expect(appleProductIdFromPriceKey("premium_year")).toBe("collectools_premium_yearly")
  })

  it("maps product IDs back to plans", () => {
    expect(priceKeyFromAppleProductId("collectools_pro_monthly")).toBe("pro_month")
    expect(planFromAppleProductId("collectools_premium_monthly")).toBe("premium")
  })

  it("covers all web checkout price keys", () => {
    expect(Object.keys(APPLE_IAP_PRODUCTS).sort()).toEqual(
      ["premium_month", "premium_year", "pro_month", "pro_year"].sort(),
    )
  })
})
