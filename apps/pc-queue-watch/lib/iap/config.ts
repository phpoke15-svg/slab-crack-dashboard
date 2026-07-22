export type IapPriceKey =
  | "premium_month"
  | "premium_year"
  | "pro_month"
  | "pro_year"

/** Keep in sync with lib/billing/apple-iap.ts on the web app. */
export const APPLE_PRODUCTS: Record<IapPriceKey, string> = {
  premium_month: "collectools_premium_monthly",
  premium_year: "collectools_premium_yearly",
  pro_month: "collectools_pro_monthly",
  pro_year: "collectools_pro_yearly",
}

export const ALL_APPLE_PRODUCT_IDS = Object.values(APPLE_PRODUCTS)

export function appleProductIdFromPriceKey(priceKey: string): string | null {
  return APPLE_PRODUCTS[priceKey as IapPriceKey] ?? null
}

export function isIapPriceKey(value: string): value is IapPriceKey {
  return value in APPLE_PRODUCTS
}
