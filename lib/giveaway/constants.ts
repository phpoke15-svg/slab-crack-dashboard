export const FREE_ACTIVE_MINUTES_REQUIRED = 30
export const PREMIUM_ACTIVE_MINUTES_REQUIRED = 10
export const PRO_ACTIVE_MINUTES_REQUIRED = 5
export const MONTHLY_ENTRY_CAP = 28
export const DAILY_APP_ENTRY_CAP = 1
export const MAIL_IN_ENTRIES_PER_POSTCARD = 7
export const MAX_MAIL_IN_POSTCARDS_PER_MONTH = 4

/** Free: 3 ads × 10 min. Premium: 2 ads × 5 min. Pro/Supreme: 1 ad × 5 min. */
export const FREE_DAILY_AD_LIMIT = 3
export const PREMIUM_DAILY_AD_LIMIT = 2
export const PRO_DAILY_AD_LIMIT = 1

/** @deprecated Use adSyntheticMinutesPerWatch(plan) — kept for free-tier default. */
export const AD_SYNTHETIC_MINUTES_PER_WATCH = 10
/** @deprecated Use dailyAdWatchLimit(plan) */
export const DAILY_AD_WATCH_LIMIT = FREE_DAILY_AD_LIMIT

/** Prize ARV per registered account at the monthly snapshot (USD). */
export const GIVEAWAY_PRIZE_PER_ACCOUNT_USD = 0.1

/** Hard cap on monthly prize ARV (keeps pool under common $5,000 state registration thresholds). */
export const GIVEAWAY_PRIZE_ARV_CAP_USD = 4999

export function giveawayPrizeArvUsd(accountCount: number): number {
  const raw = Math.max(0, Math.floor(accountCount)) * GIVEAWAY_PRIZE_PER_ACCOUNT_USD
  return Math.min(raw, GIVEAWAY_PRIZE_ARV_CAP_USD)
}

/** Cards shown on the giveaway page near today's prize ARV. */
export const GIVEAWAY_PRIZE_CARD_SHOWCASE_LIMIT = 10

/** Strict ± band around today's prize ARV when matching catalog cards (0.05 = ±5%). */
export const GIVEAWAY_PRIZE_CARD_BAND_PERCENT = 0.05

/** Live PriceCharting lookups when the cached catalog has too few ±5% matches. */
export const GIVEAWAY_PRIZE_CARD_PC_LOOKUP_LIMIT = 18
export const GIVEAWAY_PRIZE_CARD_PC_CANDIDATE_POOL = 60

/** Physical AMOE address — override with NEXT_PUBLIC_GIVEAWAY_MAILING_ADDRESS in Vercel. */
export const GIVEAWAY_MAILING_ADDRESS =
  process.env.NEXT_PUBLIC_GIVEAWAY_MAILING_ADDRESS?.trim() ||
  "CollecTools Monthly Giveaway, PO Box 25, Trenton, GA 30752"

export const GIVEAWAY_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "support@collectools.app"

export type EntrySource = "app_usage" | "mail_in"

export function utcTodayIso(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export function monthPeriod(d = new Date()): string {
  return d.toISOString().slice(0, 7)
}

export function isPremiumPlan(plan: string | null | undefined): boolean {
  return plan === "premium" || plan === "pro" || plan === "supreme"
}

export function isProOrAbove(plan: string | null | undefined): boolean {
  return plan === "pro" || plan === "supreme"
}

export function activeMinutesRequired(plan: string | null | undefined): number {
  if (isProOrAbove(plan)) return PRO_ACTIVE_MINUTES_REQUIRED
  if (plan === "premium") return PREMIUM_ACTIVE_MINUTES_REQUIRED
  return FREE_ACTIVE_MINUTES_REQUIRED
}

/** Max rewarded ads per UTC day for the user's plan (0 = ads not available). */
export function dailyAdWatchLimit(plan: string | null | undefined): number {
  if (isProOrAbove(plan)) return PRO_DAILY_AD_LIMIT
  if (plan === "premium") return PREMIUM_DAILY_AD_LIMIT
  if (!plan || plan === "free") return FREE_DAILY_AD_LIMIT
  return 0
}

/** Synthetic minutes credited per completed ad — spreads daily threshold across the plan's ad allowance. */
export function adSyntheticMinutesPerWatch(plan: string | null | undefined): number {
  const limit = dailyAdWatchLimit(plan)
  if (limit <= 0) return 0
  return activeMinutesRequired(plan) / limit
}

/** Qualifying minutes toward today's entry (active time + synthetic ad bonus). */
export function qualifyingActiveMinutes(
  activeMinutes: number,
  adsWatched: number,
  plan: string | null | undefined,
): number {
  const base = Math.max(0, Math.floor(activeMinutes))
  const limit = dailyAdWatchLimit(plan)
  const perWatch = adSyntheticMinutesPerWatch(plan)
  if (limit <= 0 || perWatch <= 0) return base
  const effectiveAds = Math.min(Math.max(0, Math.floor(adsWatched)), limit)
  return base + effectiveAds * perWatch
}

export function canEarnAdMinuteBonus(plan: string | null | undefined): boolean {
  return dailyAdWatchLimit(plan) > 0
}

/** One-line giveaway benefit for plan feature lists (pricing, FAQ). */
export function giveawayTierFeatureLine(plan: string | null | undefined): string {
  const minutes = activeMinutesRequired(plan)
  return `Monthly giveaway — earn 1 entry/day after ${minutes} active minutes (cash prize via PayPal)`
}
