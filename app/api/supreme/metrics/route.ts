import { NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { getEntitlementsForUser, isStripeConfigured } from "@/lib/billing/stripe"
import { checkPokeMatchSetup } from "@/lib/trade-binder/setup-health"
import { isQueueWatchReportsTableReady } from "@/lib/pokemon-center/queue-alerts"
import { isWalmartAffiliateConfigured } from "@/lib/restocks/walmart"
import { isWebPushConfigured } from "@/lib/push/web-push"
import { isAdsDisplayEnabled } from "@/lib/adsense-config"
import { createCrossUserReader } from "@/lib/trade-binder/cross-user-client"
import { LEGAL_SITE_NAME, LEGAL_SITE_URL } from "@/lib/legal/config"

export const dynamic = "force-dynamic"

async function countRows(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
): Promise<number | null> {
  try {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true })
    if (error) return null
    return count ?? 0
  } catch {
    return null
  }
}

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.supreme) {
    return NextResponse.json({ error: "Supreme access required" }, { status: 403 })
  }

  const supabaseConfigured = isSupabaseConfigured()
  const admin = supabaseConfigured ? createAdminClient() : null

  const tables = [
    "slab_anomalies",
    "slab_watchlist_cards",
    "slab_price_snapshots",
    "profiles",
    "subscriptions",
    "user_binders",
    "trades",
    "trade_messages",
    "push_subscriptions",
    "queue_watch_reports",
    "restock_products",
  ] as const

  const counts: Record<string, number | null> = {}
  if (admin) {
    await Promise.all(
      tables.map(async (table) => {
        counts[table] = await countRows(admin, table)
      }),
    )
  }

  let authUserCount: number | null = null
  if (admin) {
    try {
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
      authUserCount = data.users ? (data as { total?: number }).total ?? data.users.length : null
      // Prefer exact total when API provides it via pagination metadata
      const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      authUserCount = listed.data.users.length
      if (listed.data.users.length === 1000) {
        let page = 2
        let total = 1000
        while (page <= 20) {
          const next = await admin.auth.admin.listUsers({ page, perPage: 1000 })
          total += next.data.users.length
          if (next.data.users.length < 1000) break
          page += 1
        }
        authUserCount = total
      }
    } catch {
      authUserCount = null
    }
  }

  let pokematchReady: boolean | null = null
  let queueWatchReportsReady: boolean | null = null
  if (supabaseConfigured) {
    const reader = createCrossUserReader()
    if (reader) {
      try {
        pokematchReady = (await checkPokeMatchSetup(reader)).ready
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

  const planBreakdown: Record<string, number> = {}
  if (admin) {
    const { data: profiles } = await admin.from("profiles").select("plan")
    for (const row of profiles ?? []) {
      const plan = String(row.plan || "free")
      planBreakdown[plan] = (planBreakdown[plan] ?? 0) + 1
    }
  }

  return NextResponse.json({
    ok: true,
    service: LEGAL_SITE_NAME,
    siteUrl: LEGAL_SITE_URL,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
    time: new Date().toISOString(),
    you: {
      userId: auth.user.id,
      email: auth.user.email,
      plan: entitlements.plan,
    },
    checks: {
      supabaseConfigured,
      cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
      adsenseConfigured: Boolean(
        process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || process.env.NEXT_PUBLIC_ADSENSE_FEED_SLOT_ID,
      ),
      adsDisplayEnabled: isAdsDisplayEnabled(),
      stripeConfigured: isStripeConfigured(),
      walmartAffiliateConfigured: isWalmartAffiliateConfigured(),
      webPushConfigured: isWebPushConfigured(),
      restockReportSecured: Boolean(process.env.RESTOCKS_REPORT_SECRET?.trim()),
      pokematchReady,
      queueWatchReportsReady,
      discoveryMaxSetAgeYears: process.env.DISCOVERY_MAX_SET_AGE_YEARS?.trim() || "all",
      supremeEmailsConfigured: Boolean(
        process.env.SUPREME_EMAILS?.trim() || process.env.SUPREME_EMAIL?.trim(),
      ),
    },
    counts: {
      authUsers: authUserCount,
      ...counts,
    },
    planBreakdown,
  })
}
