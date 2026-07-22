import {
  intervalFromPriceKey,
  planFromPriceKey,
  type BillingInterval,
  type PlanId,
  type PriceKey,
} from "@/lib/billing/plans"

/** App Store Connect subscription product IDs (must match Connect + native IAP). */
export const APPLE_IAP_PRODUCTS: Record<PriceKey, string> = {
  premium_month: "collectools_premium_monthly",
  premium_year: "collectools_premium_yearly",
  pro_month: "collectools_pro_monthly",
  pro_year: "collectools_pro_yearly",
}

export const APPLE_IAP_PRODUCT_IDS = Object.values(APPLE_IAP_PRODUCTS)

export function appleProductIdFromPriceKey(priceKey: PriceKey): string {
  return APPLE_IAP_PRODUCTS[priceKey]
}

export function priceKeyFromAppleProductId(productId: string): PriceKey | null {
  const normalized = productId.trim()
  for (const key of Object.keys(APPLE_IAP_PRODUCTS) as PriceKey[]) {
    if (APPLE_IAP_PRODUCTS[key] === normalized) return key
  }
  return null
}

export function planFromAppleProductId(productId: string | null | undefined): PlanId {
  if (!productId) return "free"
  const priceKey = priceKeyFromAppleProductId(productId)
  if (!priceKey) return "free"
  return planFromPriceKey(priceKey)
}

export function intervalFromAppleProductId(
  productId: string | null | undefined,
): BillingInterval | null {
  if (!productId) return null
  const priceKey = priceKeyFromAppleProductId(productId)
  if (!priceKey) return null
  return intervalFromPriceKey(priceKey)
}

export function isAppleIapConfigured(): boolean {
  return Boolean(
    process.env.APPLE_IAP_KEY_ID?.trim() &&
      process.env.APPLE_IAP_ISSUER_ID?.trim() &&
      process.env.APPLE_IAP_PRIVATE_KEY?.trim(),
  )
}
