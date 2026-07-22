import { giveawayTierFeatureLine } from "@/lib/giveaway/constants"

export type PlanId = "free" | "premium" | "pro" | "supreme"

/** Public display name for each plan (free is branded as Starter). */
export function planDisplayName(plan: PlanId): string {
  switch (plan) {
    case "free":
      return "Starter"
    case "premium":
      return "Premium"
    case "pro":
      return "Pro"
    case "supreme":
      return "Supreme"
    default:
      return "Starter"
  }
}

export type BillingInterval = "month" | "year"

export type PlanTier = {
  id: Exclude<PlanId, "free" | "supreme">
  name: string
  tagline: string
  monthlyPrice: number
  yearlyPrice: number
  features: string[]
  includesQueueWatch: boolean
  adFree: boolean
  fullSlabCrack: boolean
}

export const FREE_PLAN_FEATURES = [
  "SlabCrack preview: 10 mid-deficit cards",
  "AI Portfolio ROI over time (Labs preview)",
  giveawayTierFeatureLine("free"),
  "CardLounge collector social feed",
  "PokeMatch with ads",
  "Upgrade anytime for the full feed",
] as const

export const STARTER_PLAN = {
  id: "free" as const,
  name: "Starter",
  tagline: "Free collector toolkit + daily giveaway entry (30 min)",
  features: FREE_PLAN_FEATURES,
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "premium",
    name: "Premium",
    tagline: "Full SlabCrack, ad-free + daily giveaway entry (10 min)",
    monthlyPrice: 4.99,
    yearlyPrice: 39.99,
    adFree: true,
    fullSlabCrack: true,
    includesQueueWatch: false,
    features: [
      "7-day free trial",
      giveawayTierFeatureLine("premium"),
      "Full SlabCrack deficit feed (all graded opportunities)",
      "Full AI Portfolio weekly picks + win rate (Labs)",
      "Ad-free SlabCrack and PokeMatch",
      "Cancel anytime",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "PokeWatch + full toolkit + fastest giveaway entry (5 min)",
    monthlyPrice: 9.99,
    yearlyPrice: 99.99,
    adFree: true,
    fullSlabCrack: true,
    includesQueueWatch: true,
    features: [
      "7-day free trial",
      giveawayTierFeatureLine("pro"),
      "Everything in Premium",
      "Custom hub layout — reorder your tool tiles",
      "Pokemon Center PokeWatch (web + phone alerts)",
      "Cancel anytime",
    ],
  },
]

/** Plan feature bullets shown on pricing cards (trial CTA is shown separately). */
export function displayPlanFeatures(features: readonly string[]): string[] {
  return features.filter((feature) => !feature.toLowerCase().includes("free trial"))
}

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

export function planFromPriceKey(key: PriceKey): Exclude<PlanId, "free" | "supreme"> {
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
  /** Full SlabCrack feed; free users get a mid-deficit preview only. */
  fullSlabCrack: boolean
  /** Full AI Portfolio picks + win rate; free users get cumulative ROI preview only. */
  fullAiPortfolio: boolean
  /** Reorder hub tool tiles (Pro and Supreme). */
  customHubLayout: boolean
  /** In-development tools + site metrics console (Supreme only). */
  supreme: boolean
  status: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

/** Comma-separated allowlist. Supreme is never sold via Stripe. */
export function getSupremeEmails(): string[] {
  const raw =
    process.env.SUPREME_EMAILS?.trim() ||
    process.env.SUPREME_EMAIL?.trim() ||
    ""
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isSupremeEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false
  return getSupremeEmails().includes(email.trim().toLowerCase())
}

export function entitlementsForPlan(plan: PlanId, extras?: Partial<Entitlements>): Entitlements {
  const tier = PLAN_TIERS.find((t) => t.id === plan)
  const paid = plan === "premium" || plan === "pro" || plan === "supreme"
  const supreme = plan === "supreme"
  return {
    plan,
    adFree: supreme || Boolean(tier?.adFree),
    queueWatch: supreme || Boolean(tier?.includesQueueWatch),
    fullSlabCrack: paid || Boolean(tier?.fullSlabCrack),
    fullAiPortfolio: paid,
    customHubLayout: supreme || plan === "pro",
    supreme,
    status: extras?.status ?? (plan === "free" ? null : "active"),
    currentPeriodEnd: extras?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: extras?.cancelAtPeriodEnd ?? false,
  }
}

export function isPaidPlan(plan: PlanId): plan is "premium" | "pro" | "supreme" {
  return plan === "premium" || plan === "pro" || plan === "supreme"
}

/** Rank for upgrades / webhook race resolution. */
export function planRank(plan: PlanId): number {
  if (plan === "supreme") return 3
  if (plan === "pro") return 2
  if (plan === "premium") return 1
  return 0
}
