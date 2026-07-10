export type PlanId = "free" | "premium" | "pro"

export type BillingInterval = "month" | "year"

export type PlanTier = {
  id: Exclude<PlanId, "free">
  name: string
  tagline: string
  monthlyPrice: number
  yearlyPrice: number
  features: string[]
  includesQueueWatch: boolean
  adFree: boolean
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "premium",
    name: "Premium",
    tagline: "Ad-free CollecTools",
    monthlyPrice: 1.99,
    yearlyPrice: 20,
    adFree: true,
    includesQueueWatch: false,
    features: [
      "Ad-free SlabCrack and PokeMatch",
      "Same tools as Free — without Sponsored slots",
      "Cancel anytime",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Ad-free + Pokemon Center Queue Watch",
    monthlyPrice: 9.99,
    yearlyPrice: 90,
    adFree: true,
    includesQueueWatch: true,
    features: [
      "Everything in Premium",
      "Pokemon Center Queue Watch (web + alerts)",
      "Browser notifications when the queue goes live",
      "Cancel anytime",
    ],
  },
]

export type PriceKey = "premium_month" | "premium_year" | "pro_month" | "pro_year"

export const PRICE_KEYS: PriceKey[] = [
  "premium_month",
  "premium_year",
  "pro_month",
  "pro_year",
]

/** Map Stripe price IDs from env → plan + interval. */
export function getStripePriceId(key: PriceKey): string | undefined {
  const map: Record<PriceKey, string | undefined> = {
    premium_month: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
    premium_year: process.env.STRIPE_PRICE_PREMIUM_YEARLY,
    pro_month: process.env.STRIPE_PRICE_PRO_MONTHLY,
    pro_year: process.env.STRIPE_PRICE_PRO_YEARLY,
  }
  const value = map[key]?.trim()
  return value || undefined
}

export function parsePriceKey(key: string): PriceKey | null {
  return PRICE_KEYS.includes(key as PriceKey) ? (key as PriceKey) : null
}

export function planFromPriceKey(key: PriceKey): Exclude<PlanId, "free"> {
  return key.startsWith("pro") ? "pro" : "premium"
}

export function intervalFromPriceKey(key: PriceKey): BillingInterval {
  return key.endsWith("year") ? "year" : "month"
}

export function planFromStripePriceId(priceId: string | null | undefined): PlanId {
  if (!priceId) return "free"
  for (const key of PRICE_KEYS) {
    if (getStripePriceId(key) === priceId) return planFromPriceKey(key)
  }
  return "free"
}

export type Entitlements = {
  plan: PlanId
  adFree: boolean
  queueWatch: boolean
  status: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export function entitlementsForPlan(plan: PlanId, extras?: Partial<Entitlements>): Entitlements {
  const tier = PLAN_TIERS.find((t) => t.id === plan)
  return {
    plan,
    adFree: Boolean(tier?.adFree),
    queueWatch: Boolean(tier?.includesQueueWatch),
    status: extras?.status ?? (plan === "free" ? null : "active"),
    currentPeriodEnd: extras?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: extras?.cancelAtPeriodEnd ?? false,
  }
}

export function isPaidPlan(plan: PlanId): plan is "premium" | "pro" {
  return plan === "premium" || plan === "pro"
}

/** Rank for upgrades / webhook race resolution. */
export function planRank(plan: PlanId): number {
  if (plan === "pro") return 2
  if (plan === "premium") return 1
  return 0
}
