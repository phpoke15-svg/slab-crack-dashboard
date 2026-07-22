/** Shared App Store / Google Play review demo login (both stores). */
export const STORE_REVIEWER_EMAIL = "appreview@collectools.app"

export const STORE_REVIEWER_DISPLAY_NAME = "App Review Demo"

/** Override in Vercel: STORE_REVIEWER_PASSWORD */
export function getStoreReviewerPassword(): string {
  return process.env.STORE_REVIEWER_PASSWORD?.trim() || "CollectoolsReview2026!"
}
