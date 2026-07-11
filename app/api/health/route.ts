import { NextResponse } from "next/server"
import { createCrossUserReader } from "@/lib/trade-binder/cross-user-client"
import { checkPokeMatchSetup } from "@/lib/trade-binder/setup-health"
import { isSupabaseConfigured } from "@/lib/supabase/server"
import { isQueueWatchReportsTableReady } from "@/lib/pokemon-center/queue-alerts"
import { isWalmartAffiliateConfigured } from "@/lib/restocks/walmart"
import { isWebPushConfigured } from "@/lib/push/web-push"
import { isStripeConfigured } from "@/lib/billing/stripe"
import { LEGAL_SITE_NAME, LEGAL_SITE_URL } from "@/lib/legal/config"

export const dynamic = "force-dynamic"

/** Lightweight uptime + config probe for monitoring. */
export async function GET() {
  const supabaseConfigured = isSupabaseConfigured()
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET?.trim())
  const adsenseConfigured = Boolean(
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || process.env.NEXT_PUBLIC_ADSENSE_FEED_SLOT_ID,
  )
  const stripeConfigured = isStripeConfigured()
  const walmartAffiliateConfigured = isWalmartAffiliateConfigured()
  const webPushConfigured = isWebPushConfigured()
  const restockReportSecured = Boolean(process.env.RESTOCKS_REPORT_SECRET?.trim())

  let pokematchReady: boolean | null = null
  let queueWatchReportsReady: boolean | null = null
  if (supabaseConfigured) {
    const supabase = createCrossUserReader()
    if (supabase) {
      try {
        const health = await checkPokeMatchSetup(supabase)
        pokematchReady = health.ready
      } catch {
        pokematchReady = false
      }
    }
    try {
      queueWatchReportsReady = await isQueueWatchReportsTableReady()
    } catch {
      queueWatchReportsReady = false
    }
  }

  const coreOk =
    supabaseConfigured &&
    cronSecretConfigured &&
    (pokematchReady === null || pokematchReady === true)

  const launchReady = {
    core: coreOk,
    billing: stripeConfigured,
    ads: adsenseConfigured,
    restocksWalmart: walmartAffiliateConfigured,
    phoneAlerts: webPushConfigured,
    restockReportSecured,
    queueWatchReports: queueWatchReportsReady === true,
  }

  return NextResponse.json(
    {
      ok: coreOk,
      service: LEGAL_SITE_NAME,
      siteUrl: LEGAL_SITE_URL,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      checks: {
        supabaseConfigured,
        cronSecretConfigured,
        adsenseConfigured,
        stripeConfigured,
        walmartAffiliateConfigured,
        webPushConfigured,
        restockReportSecured,
        pokematchReady,
        queueWatchReportsReady,
      },
      launchReady,
      time: new Date().toISOString(),
    },
    { status: coreOk ? 200 : 503 },
  )
}
