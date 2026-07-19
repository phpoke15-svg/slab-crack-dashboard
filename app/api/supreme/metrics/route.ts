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
import { getVercelTrafficSummary, isVercelAnalyticsConfigured } from "@/lib/vercel-analytics"

export const dynamic = "force-dynamic"

type Admin = ReturnType<typeof createAdminClient>

async function countAll(admin: Admin, table: string): Promise<number | null> {
  try {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true })
    if (error) return null
    return count ?? 0
  } catch {
    return null
  }
}

async function groupByField(
  admin: Admin,
  table: string,
  field: string,
): Promise<Record<string, number>> {
  try {
    const { data, error } = await admin.from(table).select(field)
    if (error || !data) return {}
    const out: Record<string, number> = {}
    for (const row of data) {
      const raw = (row as Record<string, unknown>)[field]
      const key = raw == null || raw === "" ? "unknown" : String(raw)
      out[key] = (out[key] ?? 0) + 1
    }
    return out
  } catch {
    return {}
  }
}

async function summarizeAuthUsers(admin: Admin): Promise<{
  total: number | null
  signedIn1d: number | null
  signedIn7d: number | null
  signedIn30d: number | null
  created1d: number | null
  created7d: number | null
  created30d: number | null
}> {
  const empty = {
    total: null as number | null,
    signedIn1d: null as number | null,
    signedIn7d: null as number | null,
    signedIn30d: null as number | null,
    created1d: null as number | null,
    created7d: null as number | null,
    created30d: null as number | null,
  }
  try {
    const now = Date.now()
    const t1 = now - 1 * 24 * 60 * 60 * 1000
    const t7 = now - 7 * 24 * 60 * 60 * 1000
    const t30 = now - 30 * 24 * 60 * 60 * 1000

    let total = 0
    let signedIn1d = 0
    let signedIn7d = 0
    let signedIn30d = 0
    let created1d = 0
    let created7d = 0
    let created30d = 0

    let page = 1
    while (page <= 20) {
      const listed = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      const users = listed.data.users
      total += users.length
      for (const u of users) {
        const signIn = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0
        if (signIn >= t1) signedIn1d += 1
        if (signIn >= t7) signedIn7d += 1
        if (signIn >= t30) signedIn30d += 1
        const created = u.created_at ? new Date(u.created_at).getTime() : 0
        if (created >= t1) created1d += 1
        if (created >= t7) created7d += 1
        if (created >= t30) created30d += 1
      }
      if (users.length < 1000) break
      page += 1
    }

    return {
      total,
      signedIn1d,
      signedIn7d,
      signedIn30d,
      created1d,
      created7d,
      created30d,
    }
  } catch {
    return empty
  }
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
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
    "slab_cards",
    "slab_anomalies",
    "slab_watchlist_cards",
    "slab_price_snapshots",
    "profiles",
    "subscriptions",
    "user_binders",
    "friendships",
    "trades",
    "trade_items",
    "trade_messages",
    "reviews",
    "user_reports",
    "user_blocks",
    "binder_card_prices",
    "push_subscriptions",
    "queue_watch_reports",
    "restock_products",
    "restock_events",
  ] as const

  const counts: Record<string, number | null> = {}
  let authUserCount: number | null = null
  let accounts = {
    total: null as number | null,
    created1d: null as number | null,
    created7d: null as number | null,
    created30d: null as number | null,
    signedIn1d: null as number | null,
    signedIn7d: null as number | null,
    signedIn30d: null as number | null,
  }
  let activity = {
    activeNow: null as number | null,
    active1d: null as number | null,
    active7d: null as number | null,
    active30d: null as number | null,
    everSeen: null as number | null,
  }
  let planBreakdown: Record<string, number> = {}
  let subscriptionStatus: Record<string, number> = {}
  let subscriptionPlan: Record<string, number> = {}
  let bindersByStatus: Record<string, number> = {}
  let friendshipsByStatus: Record<string, number> = {}
  let tradesByStatus: Record<string, number> = {}
  let restockByRetailer: Record<string, number> = {}
  let profilesLast7d: number | null = null
  let profilesLast30d: number | null = null
  let payingProfiles: number | null = null
  let activeSubscriptions: number | null = null
  let cancelAtPeriodEnd: number | null = null
  let restockInStock: number | null = null
  let queueWatchLive: number | null = null
  let anomaliesHigh: number | null = null

  if (admin) {
    await Promise.all(
      tables.map(async (table) => {
        counts[table] = await countAll(admin, table)
      }),
    )

    const authSummary = await summarizeAuthUsers(admin)
    authUserCount = authSummary.total
    accounts = {
      total: authSummary.total,
      created1d: authSummary.created1d,
      created7d: authSummary.created7d,
      created30d: authSummary.created30d,
      signedIn1d: authSummary.signedIn1d,
      signedIn7d: authSummary.signedIn7d,
      signedIn30d: authSummary.signedIn30d,
    }

    const since15m = minutesAgoIso(15)
    const since1 = daysAgoIso(1)
    const since7 = daysAgoIso(7)
    const since30 = daysAgoIso(30)

    const [
      planBd,
      subStatus,
      subPlan,
      binderStatus,
      friendStatus,
      tradeStatus,
      retailerBd,
      p7,
      p30,
      paying,
      activeSubs,
      canceling,
      inStock,
      liveQueue,
      highAnomalies,
      seenNow,
      seen1d,
      seen7d,
      seen30d,
      everSeen,
    ] = await Promise.all([
      groupByField(admin, "profiles", "plan"),
      groupByField(admin, "subscriptions", "status"),
      groupByField(admin, "subscriptions", "plan"),
      groupByField(admin, "user_binders", "status"),
      groupByField(admin, "friendships", "status"),
      groupByField(admin, "trades", "status"),
      groupByField(admin, "restock_products", "retailer"),
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since7)
        .then(({ count, error }) => (error ? null : (count ?? 0))),
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since30)
        .then(({ count, error }) => (error ? null : (count ?? 0))),
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .in("plan", ["premium", "pro", "supreme"])
        .then(({ count, error }) => (error ? null : (count ?? 0))),
      admin
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .then(({ count, error }) => (error ? null : (count ?? 0))),
      admin
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("cancel_at_period_end", true)
        .then(({ count, error }) => (error ? null : (count ?? 0))),
      admin
        .from("restock_products")
        .select("*", { count: "exact", head: true })
        .eq("in_stock", true)
        .then(({ count, error }) => (error ? null : (count ?? 0))),
      admin
        .from("queue_watch_reports")
        .select("*", { count: "exact", head: true })
        .eq("live", true)
        .then(({ count, error }) => (error ? null : (count ?? 0))),
      admin
        .from("slab_anomalies")
        .select("*", { count: "exact", head: true })
        .gte("percentage_savings", 20)
        .then(({ count, error }) => (error ? null : (count ?? 0))),
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_seen_at", since15m)
        .then(({ count, error }) => (error ? null : (count ?? 0))),
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_seen_at", since1)
        .then(({ count, error }) => (error ? null : (count ?? 0))),
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_seen_at", since7)
        .then(({ count, error }) => (error ? null : (count ?? 0))),
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_seen_at", since30)
        .then(({ count, error }) => (error ? null : (count ?? 0))),
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .not("last_seen_at", "is", null)
        .then(({ count, error }) => (error ? null : (count ?? 0))),
    ])

    planBreakdown = planBd
    subscriptionStatus = subStatus
    subscriptionPlan = subPlan
    bindersByStatus = binderStatus
    friendshipsByStatus = friendStatus
    tradesByStatus = tradeStatus
    restockByRetailer = retailerBd
    profilesLast7d = p7
    profilesLast30d = p30
    payingProfiles = paying
    activeSubscriptions = activeSubs
    cancelAtPeriodEnd = canceling
    restockInStock = inStock
    queueWatchLive = liveQueue
    anomaliesHigh = highAnomalies
    activity = {
      activeNow: seenNow,
      active1d: seen1d,
      active7d: seen7d,
      active30d: seen30d,
      everSeen,
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

  const checks = {
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
    vercelAnalyticsConfigured: isVercelAnalyticsConfigured(),
  }

  const traffic = await getVercelTrafficSummary()

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
    checks,
    overview: {
      authUsers: authUserCount,
      profiles: counts.profiles ?? null,
      payingProfiles,
      activeSubscriptions,
      trades: counts.trades ?? null,
      binders: counts.user_binders ?? null,
      anomalies: counts.slab_anomalies ?? null,
      pushSubscriptions: counts.push_subscriptions ?? null,
      queueReports: counts.queue_watch_reports ?? null,
      restockProducts: counts.restock_products ?? null,
    },
    accounts,
    activity,
    growth: {
      profilesLast7d,
      profilesLast30d,
      planBreakdown,
    },
    billing: {
      subscriptionStatus,
      subscriptionPlan,
      cancelAtPeriodEnd,
    },
    pokematch: {
      bindersByStatus,
      friendshipsByStatus,
      tradesByStatus,
      tradeItems: counts.trade_items ?? null,
      tradeMessages: counts.trade_messages ?? null,
      reviews: counts.reviews ?? null,
      userReports: counts.user_reports ?? null,
      userBlocks: counts.user_blocks ?? null,
      binderCardPrices: counts.binder_card_prices ?? null,
      friendships: counts.friendships ?? null,
    },
    slabcrack: {
      slabCards: counts.slab_cards ?? null,
      anomalies: counts.slab_anomalies ?? null,
      anomaliesHighSavings: anomaliesHigh,
      watchlistCards: counts.slab_watchlist_cards ?? null,
      priceSnapshots: counts.slab_price_snapshots ?? null,
    },
    ops: {
      restockProducts: counts.restock_products ?? null,
      restockInStock,
      restockEvents: counts.restock_events ?? null,
      restockByRetailer,
      queueWatchReports: counts.queue_watch_reports ?? null,
      queueWatchLive,
      pushSubscriptions: counts.push_subscriptions ?? null,
    },
    counts: {
      authUsers: authUserCount,
      ...counts,
    },
    planBreakdown,
    traffic,
  })
}
