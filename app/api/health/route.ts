import { NextResponse } from "next/server"
import { createCrossUserReader } from "@/lib/trade-binder/cross-user-client"
import { checkPokeMatchSetup } from "@/lib/trade-binder/setup-health"
import { isSupabaseConfigured } from "@/lib/supabase/server"
import { isWalmartAffiliateConfigured } from "@/lib/restocks/walmart"
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

  let pokematchReady: boolean | null = null
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
  }

  const ok =
    supabaseConfigured &&
    cronSecretConfigured &&
    (pokematchReady === null || pokematchReady === true)

  return NextResponse.json(
    {
      ok,
      service: LEGAL_SITE_NAME,
      siteUrl: LEGAL_SITE_URL,
      checks: {
        supabaseConfigured,
        cronSecretConfigured,
        adsenseConfigured,
        stripeConfigured,
        walmartAffiliateConfigured,
        pokematchReady,
      },
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  )
}
