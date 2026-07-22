import "server-only"
import { APPLE_IAP_PRODUCTS, isAppleIapConfigured } from "@/lib/billing/apple-iap"
import { PLAN_TIERS } from "@/lib/billing/plans"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  getStoreReviewerPassword,
  STORE_REVIEWER_EMAIL,
} from "@/lib/store-reviewer"

export const APP_STORE_REVIEW_NOTES = `CollecTools is a WebView of https://www.collectools.app with native PokeWatch queue monitoring.

Sign in with the demo account below (Pro plan pre-enabled).

To test PokeWatch:
1. Open app → sign in
2. Hub → PokeWatch
3. Tap "Open native PokeWatch" for Imperva-safe monitoring + local alerts

To test subscriptions:
Pricing → tap Premium or Pro → Apple In-App Purchase sheet
Use "Restore purchases" if needed.

No Google Play references appear in the iOS app. Subscriptions use In-App Purchase only.`

export const APP_STORE_SUBSCRIPTION_SCREENSHOTS = {
  premium: "apps/pc-queue-watch/store-assets/iap-review/collectools-premium-plan.png",
  pro: "apps/pc-queue-watch/store-assets/iap-review/collectools-pro-plan.png",
} as const

export function getAppStoreSubscriptionCatalog() {
  const premium = PLAN_TIERS.find((t) => t.id === "premium")!
  const pro = PLAN_TIERS.find((t) => t.id === "pro")!

  return [
    {
      plan: "premium" as const,
      productIds: {
        monthly: APPLE_IAP_PRODUCTS.premium_month,
        yearly: APPLE_IAP_PRODUCTS.premium_year,
      },
      prices: { monthly: premium.monthlyPrice, yearly: premium.yearlyPrice },
      reviewScreenshot: APP_STORE_SUBSCRIPTION_SCREENSHOTS.premium,
    },
    {
      plan: "pro" as const,
      productIds: {
        monthly: APPLE_IAP_PRODUCTS.pro_month,
        yearly: APPLE_IAP_PRODUCTS.pro_year,
      },
      prices: { monthly: pro.monthlyPrice, yearly: pro.yearlyPrice },
      reviewScreenshot: APP_STORE_SUBSCRIPTION_SCREENSHOTS.pro,
    },
  ]
}

export type AppStoreSetupStatus = {
  ready: boolean
  checks: {
    supabaseConfigured: boolean
    appleIapConfigured: boolean
    storeReviewerAccount: boolean
    storeReviewerPro: boolean
  }
  reviewer: {
    email: string
    password: string
  }
  subscriptions: ReturnType<typeof getAppStoreSubscriptionCatalog>
  reviewNotes: string
  vercelEnv: string[]
  nextSteps: string[]
}

async function findStoreReviewerUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const admin = createAdminClient()
  const email = STORE_REVIEWER_EMAIL.toLowerCase()

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return null
  return data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null
}

export async function getAppStoreSetupStatus(): Promise<AppStoreSetupStatus> {
  const supabaseConfigured = isSupabaseConfigured()
  const appleIapConfigured = isAppleIapConfigured()
  const reviewerId = await findStoreReviewerUserId()
  let storeReviewerPro = false

  if (reviewerId) {
    try {
      const entitlements = await getEntitlementsForUser(reviewerId)
      storeReviewerPro = entitlements.queueWatch
    } catch {
      storeReviewerPro = false
    }
  }

  const vercelEnv = [
    "APPLE_IAP_KEY_ID",
    "APPLE_IAP_ISSUER_ID",
    "APPLE_IAP_PRIVATE_KEY",
    "APPLE_IAP_BUNDLE_ID (optional)",
    "STORE_REVIEWER_PASSWORD (optional)",
  ]

  const nextSteps: string[] = []
  if (!supabaseConfigured) {
    nextSteps.push("Configure Supabase env vars on Vercel.")
  }
  if (!appleIapConfigured) {
    nextSteps.push("Add Apple IAP API keys to Vercel (Users and Access → Keys → .p8 file).")
  }
  if (!reviewerId || !storeReviewerPro) {
    nextSteps.push(
      'POST /api/admin/app-store-setup with CRON_SECRET to create the review Pro account.',
    )
  }
  nextSteps.push("Run supabase/app-store-launch.sql once in Supabase SQL Editor.")
  nextSteps.push(
    "App Store Connect: create 4 subscriptions (see subscriptions list in this response).",
  )
  nextSteps.push(
    "Upload iap-review PNGs to each subscription’s Review Information screenshot slot.",
  )
  nextSteps.push("eas build -p ios --profile production && eas submit -p ios")

  const ready =
    supabaseConfigured &&
    appleIapConfigured &&
    Boolean(reviewerId) &&
    storeReviewerPro

  return {
    ready,
    checks: {
      supabaseConfigured,
      appleIapConfigured,
      storeReviewerAccount: Boolean(reviewerId),
      storeReviewerPro,
    },
    reviewer: {
      email: STORE_REVIEWER_EMAIL,
      password: getStoreReviewerPassword(),
    },
    subscriptions: getAppStoreSubscriptionCatalog(),
    reviewNotes: APP_STORE_REVIEW_NOTES,
    vercelEnv,
    nextSteps,
  }
}
