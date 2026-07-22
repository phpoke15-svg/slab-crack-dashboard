export const BUCKET_TIERS = ["100", "250", "500", "1000"] as const

export type BucketTier = (typeof BUCKET_TIERS)[number]

export type TierBudgetRange = {
  min: number
  max: number
  label: string
}

export const TIER_BUDGETS: Record<BucketTier, TierBudgetRange> = {
  "100": { min: 85, max: 100, label: "$100 / week" },
  "250": { min: 225, max: 250, label: "$250 / week" },
  "500": { min: 450, max: 500, label: "$500 / week" },
  "1000": { min: 900, max: 1000, label: "$1,000 / week" },
}

export const CANDIDATE_MIN_PRICE = 25
export const CANDIDATE_MAX_PRICE = 1000

export function priceInCandidateRange(price: number): boolean {
  return price >= CANDIDATE_MIN_PRICE && price <= CANDIDATE_MAX_PRICE
}

/** True when at least one grade price (raw or PSA 10) fits the weekly pick window. */
export function cardHasPickablePrice(raw: number, psa10: number): boolean {
  return priceInCandidateRange(raw) || priceInCandidateRange(psa10)
}

export function parseBucketTier(value: string | null | undefined): BucketTier | null {
  const normalized = String(value ?? "").trim()
  if (normalized === "100" || normalized === "250" || normalized === "500" || normalized === "1000") {
    return normalized
  }
  return null
}

export function tierBudgetSpent(pickPrices: number[]): number {
  return Number(pickPrices.reduce((sum, price) => sum + price, 0).toFixed(2))
}

export function tierBudgetInRange(spent: number, tier: BucketTier): boolean {
  const { min, max } = TIER_BUDGETS[tier]
  return spent >= min && spent <= max
}
