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

export type SlabFeedAccess = "preview" | "top100" | "full"

export type PlanTier = {
  id: Exclude<PlanId, "free" | "supreme">
  name: string
  tagline: string
  monthlyPrice: number
  yearlyPrice: number
  features: string[]
  includesQueueWatch: boolean
  adFree: boolean
  slabFeedAccess: SlabFeedAccess
  cardScanner: boolean
  fullSearch: boolean
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "premium",
    name: "Premium",
    tagline: "Top 100 SlabCrack + SlabLab, ad-free",
    monthlyPrice: 4.99,
    yearlyPrice: 39.99,
    adFree: true,
    slabFeedAccess: "top100",
    cardScanner: false,
    fullSearch: false,
    includesQueueWatch: false,
    features: [
      "7-day free trial",
      "Top 100 SlabCrack deficit cards + Top 100 SlabLab ROI board",
      "Ad-free SlabCrack and PokeMatch",
      "Full CardLounge, PokeMatch, and Feedback",
      "Cancel anytime",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "All six tools, scanner + search",
    monthlyPrice: 9.99,
    yearlyPrice: 99.99,
    adFree: true,
    slabFeedAccess: "full",
    cardScanner: true,
    fullSearch: true,
    includesQueueWatch: true,
    features: [
      "7-day free trial",
      "Everything in Premium",
      "Full SlabCrack + SlabLab feeds, search, and camera scanner",
      "Pokemon Center PokeWatch (web + phone alerts)",
      "Cancel anytime",
    ],
  },
]

export const FREE_PLAN_FEATURES = [
  "SlabCrack + SlabLab: 10 mid-ranked cards each (no scanner)",
  "Full CardLounge collector social feed",
  "Full PokeMatch trading",
  "Full Feedback voting + submissions",
  "Upgrade for top 100 boards, ad-free, or Pro for scanner + PokeWatch",
] as const

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
  /** SlabCrack + SlabLab feed depth. */
  slabFeedAccess: SlabFeedAccess
  /** Camera identify (/slabcrack/scan, /slablab/scan). */
  cardScanner: boolean
  /** Catalog search + SlabLab board filter. */
  fullSearch: boolean
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
  const supreme = plan === "supreme"
  return {
    plan,
    adFree: supreme || Boolean(tier?.adFree),
    queueWatch: supreme || Boolean(tier?.includesQueueWatch),
    slabFeedAccess: supreme ? "full" : tier?.slabFeedAccess ?? "preview",
    cardScanner: supreme || Boolean(tier?.cardScanner),
    fullSearch: supreme || Boolean(tier?.fullSearch),
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
