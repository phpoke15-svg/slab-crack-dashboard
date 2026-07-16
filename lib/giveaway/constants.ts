export const FREE_ACTIVE_MINUTES_REQUIRED = 30
export const PREMIUM_ACTIVE_MINUTES_REQUIRED = 15
export const MONTHLY_ENTRY_CAP = 28
export const DAILY_APP_ENTRY_CAP = 1
export const MAIL_IN_ENTRIES_PER_POSTCARD = 7
export const MAX_MAIL_IN_POSTCARDS_PER_MONTH = 4

/** Prize ARV per registered account at the monthly snapshot (USD). */
export const GIVEAWAY_PRIZE_PER_ACCOUNT_USD = 0.25

/** Optional physical AMOE address — set NEXT_PUBLIC_GIVEAWAY_MAILING_ADDRESS in Vercel. */
export const GIVEAWAY_MAILING_ADDRESS =
  process.env.NEXT_PUBLIC_GIVEAWAY_MAILING_ADDRESS?.trim() || ""

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

export function activeMinutesRequired(isPremium: boolean): number {
  return isPremium ? PREMIUM_ACTIVE_MINUTES_REQUIRED : FREE_ACTIVE_MINUTES_REQUIRED
}
