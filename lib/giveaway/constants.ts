export const FREE_ACTIVE_MINUTES_REQUIRED = 30
export const PREMIUM_ACTIVE_MINUTES_REQUIRED = 10
export const PRO_ACTIVE_MINUTES_REQUIRED = 5
export const MONTHLY_ENTRY_CAP = 28
export const DAILY_APP_ENTRY_CAP = 1
export const MAIL_IN_ENTRIES_PER_POSTCARD = 7
export const MAX_MAIL_IN_POSTCARDS_PER_MONTH = 4

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

/** Progressive widening when the strict band has no catalog matches. */
export const GIVEAWAY_PRIZE_CARD_RELAXED_BAND_PERCENTS = [0.15, 0.35, 0.75, 1.5] as const

/** Minimum carousel cards — page must never show an empty showcase. */
export const GIVEAWAY_PRIZE_CARD_MIN_SHOWCASE = 3

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

/** One-line giveaway benefit for plan feature lists (pricing, FAQ). */
export function giveawayTierFeatureLine(plan: string | null | undefined): string {
  const minutes = activeMinutesRequired(plan)
  return `Monthly giveaway — earn 1 entry/day after ${minutes} active minutes (cash prize via PayPal)`
}
