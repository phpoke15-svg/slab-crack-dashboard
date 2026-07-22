"use client"

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  BarChart3,
  FlaskConical,
  Globe,
  Gift,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Users,
  Wallet,
  Layers,
  Store,
  HeartHandshake,
} from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { SupremeBroadcastPanel } from "@/components/supreme-broadcast-panel"
import { GiveawayAdminPanel } from "@/components/giveaway-admin-panel"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useEntitlements } from "@/components/billing/entitlements-provider"
import { SUPREME_TOOLS } from "@/lib/collectools-tools"
import type { VercelTrafficSummary } from "@/lib/vercel-analytics"
import { cn } from "@/lib/utils"

type MetricsPayload = {
  ok: boolean
  service: string
  siteUrl: string
  commit: string | null
  env: string | null
  time: string
  you: { userId: string; email?: string | null; plan: string }
  checks: Record<string, boolean | string | null>
  overview: {
    authUsers: number | null
    profiles: number | null
    payingProfiles: number | null
    activeSubscriptions: number | null
    trades: number | null
    binders: number | null
    anomalies: number | null
    pushSubscriptions: number | null
    queueReports: number | null
    restockProducts: number | null
  }
  accounts: {
    total: number | null
    created1d: number | null
    created7d: number | null
    created30d: number | null
    signedIn1d: number | null
    signedIn7d: number | null
    signedIn30d: number | null
  }
  activity: {
    activeNow: number | null
    active1d: number | null
    active7d: number | null
    active30d: number | null
    everSeen: number | null
  }
  growth: {
    profilesLast7d: number | null
    profilesLast30d: number | null
    planBreakdown: Record<string, number>
  }
  billing: {
    subscriptionStatus: Record<string, number>
    subscriptionPlan: Record<string, number>
    cancelAtPeriodEnd: number | null
  }
  pokematch: {
    bindersByStatus: Record<string, number>
    friendshipsByStatus: Record<string, number>
    tradesByStatus: Record<string, number>
    tradeItems: number | null
    tradeMessages: number | null
    reviews: number | null
    userReports: number | null
    userBlocks: number | null
    binderCardPrices: number | null
    friendships: number | null
  }
  slabcrack: {
    slabCards: number | null
    anomalies: number | null
    anomaliesHighSavings: number | null
    watchlistCards: number | null
    priceSnapshots: number | null
  }
  ops: {
    restockProducts: number | null
    restockInStock: number | null
    restockEvents: number | null
    restockByRetailer: Record<string, number>
    queueWatchReports: number | null
    queueWatchLive: number | null
    pushSubscriptions: number | null
  }
  counts: Record<string, number | null>
  traffic?: VercelTrafficSummary
  error?: string
}

const CHECK_LABELS: Record<string, string> = {
  supabaseConfigured: "Supabase",
  cronSecretConfigured: "Cron secret",
  adsenseConfigured: "AdSense keys",
  adsDisplayEnabled: "Ads display",
  stripeConfigured: "Stripe",
  walmartAffiliateConfigured: "Walmart affiliate",
  webPushConfigured: "Web push",
  restockReportSecured: "Restock report secret",
  pokematchReady: "PokeMatch schema",
  queueWatchReportsReady: "PokeWatch table",
  discoveryMaxSetAgeYears: "Discovery max set age",
  supremeEmailsConfigured: "Supreme allowlist",
  vercelAnalyticsConfigured: "Vercel Analytics API",
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—"
  return n.toLocaleString()
}

export function SupremeConsoleClient() {
  const { user, isLoading: authLoading, openAuthModal } = useAuth()
  const entitlements = useEntitlements()
  const [data, setData] = useState<MetricsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/supreme/metrics", { credentials: "same-origin" })
      const json = (await res.json().catch(() => null)) as MetricsPayload | null
      if (!res.ok || !json) {
        setData(null)
        setError(json && "error" in json ? String(json.error) : "Could not load metrics")
        return
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load metrics")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || entitlements.isLoading) return
    if (!user) return
    if (!entitlements.supreme) return
    void load()
  }, [authLoading, entitlements.isLoading, entitlements.supreme, user, load])

  const checkEntries = useMemo(() => {
    if (!data) return []
    return Object.entries(data.checks).map(([key, value]) => ({
      key,
      label: CHECK_LABELS[key] ?? key,
      value,
    }))
  }, [data])

  const readyCount = checkEntries.filter(
    (c) => c.value === true || (typeof c.value === "string" && c.value.length > 0),
  ).length

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.14_155_/_0.14),transparent_55%)]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CollecToolsBrand href="/" size="lg" subtitle="Supreme · site insights" />
            <h1 className="mt-5 flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              <BarChart3 className="size-7 text-primary" aria-hidden="true" />
              Site Insights
            </h1>
          </div>
          <SiteAuthButton className="shrink-0" />
        </header>

        {authLoading || entitlements.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking access…
          </p>
        ) : !user ? (
          <div className="rounded-2xl border border-border bg-card/60 p-6">
            <p className="text-sm text-muted-foreground">Sign in with your owner account.</p>
            <button
              type="button"
              onClick={openAuthModal}
              className="mt-4 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Sign in
            </button>
          </div>
        ) : !entitlements.supreme ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <ShieldAlert className="size-4" /> Supreme access required
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This console is limited to allowlisted owner emails. Your plan:{" "}
              <span className="font-medium text-foreground">{entitlements.plan}</span>
            </p>
            <Link href="/" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
              Back to tools
            </Link>
          </div>
        ) : (
          <>
            <section id="giveaway" className="mb-10 scroll-mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Gift className="size-3.5 text-primary" /> Monthly giveaway
              </h2>
              <GiveawayAdminPanel />
            </section>

            <section className="mb-10">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <FlaskConical className="size-3.5" /> In development
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {SUPREME_TOOLS.filter((t) => t.id !== "supreme").map((tool) => {
                  const Icon = tool.icon
                  return (
                    <Link
                      key={tool.id}
                      href={tool.href}
                      className="group rounded-2xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:border-primary/50 hover:bg-primary/10"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 items-center justify-center rounded-xl border border-primary/30 bg-background text-primary">
                          <Icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{tool.name}</h3>
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                              Dev
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>

            <div className="mb-8">
              <SupremeBroadcastPanel
                pushOptIns={data?.ops.pushSubscriptions ?? data?.overview.pushSubscriptions ?? null}
                webPushConfigured={data?.checks.webPushConfigured ?? null}
              />
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Insights
                </h2>
                {data && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {new Date(data.time).toLocaleString()} · {data.env ?? "local"} ·{" "}
                    <span className="font-mono">{data.commit ?? "—"}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                Refresh
              </button>
            </div>

            {error && (
              <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {loading && !data ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading insights…
              </p>
            ) : data ? (
              <div className="space-y-8">
                {/* Overview KPIs */}
                <section>
                  <SectionLabel icon={Activity} title="Overview" />
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Kpi
                      label="Accounts"
                      value={fmt(data.accounts?.total ?? data.overview.authUsers)}
                      hint={`${fmt(data.accounts?.created7d)} new · 7d`}
                    />
                    <Kpi
                      label="Active now"
                      value={fmt(data.activity?.activeNow)}
                      hint="seen in last 15 min"
                    />
                    <Kpi
                      label="Active · 7d"
                      value={fmt(data.activity?.active7d)}
                      hint={`${fmt(data.accounts?.signedIn7d)} signed in · 7d`}
                    />
                    <Kpi
                      label="Paying plans"
                      value={fmt(data.overview.payingProfiles)}
                      hint={`${fmt(data.overview.activeSubscriptions)} active subs`}
                    />
                    <Kpi
                      label="Slab anomalies"
                      value={fmt(data.overview.anomalies)}
                      hint={`${fmt(data.slabcrack.anomaliesHighSavings)} ≥20% save`}
                    />
                  </div>
                </section>

                {/* Site traffic (Vercel Analytics) */}
                <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
                  <SectionLabel icon={Globe} title="Site traffic" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Production page views and visitors from Vercel Web Analytics.
                    {data.traffic?.fetchedAt ? (
                      <>
                        {" "}
                        Updated {new Date(data.traffic.fetchedAt).toLocaleString()}.
                      </>
                    ) : null}
                  </p>

                  {!data.traffic?.configured ? (
                    <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
                      Add a Vercel access token as{" "}
                      <span className="font-mono">VERCEL_ANALYTICS_TOKEN</span> in Production env
                      vars, then redeploy. Project ID is picked up automatically from{" "}
                      <span className="font-mono">VERCEL_PROJECT_ID</span>.
                    </p>
                  ) : data.traffic.error ? (
                    <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {data.traffic.error}
                    </p>
                  ) : (
                    <>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Kpi
                          label={`Visitors · ${data.traffic.monthLabel}`}
                          value={fmt(data.traffic.periods.monthToDate.visitors)}
                          hint={`${fmt(data.traffic.periods.monthToDate.pageviews)} page views`}
                        />
                        <Kpi
                          label="Visitors · 30d"
                          value={fmt(data.traffic.periods.last30d.visitors)}
                          hint={`${fmt(data.traffic.periods.last30d.pageviews)} page views`}
                        />
                        <Kpi
                          label="Visitors · 7d"
                          value={fmt(data.traffic.periods.last7d.visitors)}
                          hint={`${fmt(data.traffic.periods.last7d.pageviews)} page views`}
                        />
                        <Kpi
                          label="Visitors · today"
                          value={fmt(data.traffic.periods.today.visitors)}
                          hint={`${fmt(data.traffic.periods.today.pageviews)} page views`}
                        />
                      </div>

                      {data.traffic.dailyLast30d.length > 0 ? (
                        <div className="mt-6">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Daily visitors · last 30 days
                          </p>
                          <TrafficSparkline points={data.traffic.dailyLast30d} />
                        </div>
                      ) : null}

                      <div className="mt-6 grid gap-6 md:grid-cols-3">
                        <TrafficBreakdown title="Top routes" rows={data.traffic.topRoutes} />
                        <TrafficBreakdown title="Top referrers" rows={data.traffic.topReferrers} />
                        <TrafficBreakdown title="Top countries" rows={data.traffic.topCountries} />
                      </div>
                    </>
                  )}
                </section>

                {/* Accounts & activity */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
                    <SectionLabel icon={Users} title="Accounts" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Auth accounts (sign-ups and last sign-in from Supabase Auth).
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MiniStat label="Total accounts" value={fmt(data.accounts?.total)} />
                      <MiniStat label="Profiles" value={fmt(data.overview.profiles)} />
                      <MiniStat label="Created · 1d" value={fmt(data.accounts?.created1d)} />
                      <MiniStat label="Created · 7d" value={fmt(data.accounts?.created7d)} />
                      <MiniStat label="Created · 30d" value={fmt(data.accounts?.created30d)} />
                      <MiniStat label="Signed in · 1d" value={fmt(data.accounts?.signedIn1d)} />
                      <MiniStat label="Signed in · 7d" value={fmt(data.accounts?.signedIn7d)} />
                      <MiniStat label="Signed in · 30d" value={fmt(data.accounts?.signedIn30d)} />
                    </div>
                  </section>

                  <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
                    <SectionLabel icon={Activity} title="Active users" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      On-site activity from signed-in sessions (updates about every 5 minutes).
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MiniStat label="Active now · 15m" value={fmt(data.activity?.activeNow)} />
                      <MiniStat label="Active · 1d" value={fmt(data.activity?.active1d)} />
                      <MiniStat label="Active · 7d" value={fmt(data.activity?.active7d)} />
                      <MiniStat label="Active · 30d" value={fmt(data.activity?.active30d)} />
                      <MiniStat
                        label="Ever tracked"
                        value={fmt(data.activity?.everSeen)}
                        className="col-span-2"
                      />
                    </div>
                    {data.activity?.everSeen == null && (
                      <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">
                        Run <span className="font-mono">supabase/profile-last-seen.sql</span> in
                        Supabase to enable on-site activity tracking.
                      </p>
                    )}
                  </section>
                </div>

                {/* Growth + billing */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
                    <SectionLabel icon={Users} title="Growth & plans" />
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MiniStat label="New profiles · 7d" value={fmt(data.growth.profilesLast7d)} />
                      <MiniStat label="New profiles · 30d" value={fmt(data.growth.profilesLast30d)} />
                    </div>
                    <div className="mt-5">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Profiles by plan
                      </p>
                      <BreakdownBars data={data.growth.planBreakdown} />
                    </div>
                  </section>

                  <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
                    <SectionLabel icon={Wallet} title="Billing" />
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MiniStat
                        label="Active subscriptions"
                        value={fmt(data.overview.activeSubscriptions)}
                      />
                      <MiniStat
                        label="Cancel at period end"
                        value={fmt(data.billing.cancelAtPeriodEnd)}
                      />
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          By status
                        </p>
                        <BreakdownBars data={data.billing.subscriptionStatus} />
                      </div>
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          By plan
                        </p>
                        <BreakdownBars data={data.billing.subscriptionPlan} />
                      </div>
                    </div>
                  </section>
                </div>

                {/* PokeMatch */}
                <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
                  <SectionLabel icon={HeartHandshake} title="PokeMatch" />
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MiniStat label="Binder cards" value={fmt(data.overview.binders)} />
                    <MiniStat label="Friendships" value={fmt(data.pokematch.friendships)} />
                    <MiniStat label="Trade messages" value={fmt(data.pokematch.tradeMessages)} />
                    <MiniStat label="Reviews" value={fmt(data.pokematch.reviews)} />
                    <MiniStat label="Trade items" value={fmt(data.pokematch.tradeItems)} />
                    <MiniStat label="Priced catalog" value={fmt(data.pokematch.binderCardPrices)} />
                    <MiniStat label="User reports" value={fmt(data.pokematch.userReports)} />
                    <MiniStat label="Blocks" value={fmt(data.pokematch.userBlocks)} />
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Binders by status
                      </p>
                      <BreakdownBars data={data.pokematch.bindersByStatus} />
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Trades by status
                      </p>
                      <BreakdownBars data={data.pokematch.tradesByStatus} />
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Friendships
                      </p>
                      <BreakdownBars data={data.pokematch.friendshipsByStatus} />
                    </div>
                  </div>
                </section>

                {/* SlabCrack + Ops */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
                    <SectionLabel icon={Layers} title="SlabCrack / SlabIt" />
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MiniStat label="Catalog cards" value={fmt(data.slabcrack.slabCards)} />
                      <MiniStat label="Watchlist" value={fmt(data.slabcrack.watchlistCards)} />
                      <MiniStat label="Anomalies" value={fmt(data.slabcrack.anomalies)} />
                      <MiniStat
                        label="High savings (≥20%)"
                        value={fmt(data.slabcrack.anomaliesHighSavings)}
                      />
                      <MiniStat
                        label="Price snapshots"
                        value={fmt(data.slabcrack.priceSnapshots)}
                        className="col-span-2"
                      />
                    </div>
                  </section>

                  <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
                    <SectionLabel icon={Store} title="Restocks & PokeWatch" />
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MiniStat label="Tracked SKUs" value={fmt(data.ops.restockProducts)} />
                      <MiniStat label="In stock now" value={fmt(data.ops.restockInStock)} />
                      <MiniStat label="Stock events" value={fmt(data.ops.restockEvents)} />
                      <MiniStat label="Push opt-ins" value={fmt(data.ops.pushSubscriptions)} />
                      <MiniStat label="Queue reports" value={fmt(data.ops.queueWatchReports)} />
                      <MiniStat label="Live queue flags" value={fmt(data.ops.queueWatchLive)} />
                    </div>
                    <div className="mt-5">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Products by retailer
                      </p>
                      <BreakdownBars data={data.ops.restockByRetailer} />
                    </div>
                  </section>
                </div>

                {/* Launch readiness */}
                <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <SectionLabel icon={Activity} title="Launch readiness" />
                    <p className="text-xs text-muted-foreground">
                      {readyCount}/{checkEntries.length} configured
                    </p>
                  </div>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {checkEntries.map(({ key, label, value }) => (
                      <li
                        key={key}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-xs"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <StatusPill value={value} />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Site URL · {data.siteUrl} · signed in as {data.you.email}
                  </p>
                </section>

                {/* Raw counts */}
                <section>
                  <button
                    type="button"
                    onClick={() => setShowRaw((v) => !v)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {showRaw ? "Hide" : "Show"} raw table counts
                  </button>
                  {showRaw && (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(data.counts).map(([key, value]) => (
                        <li
                          key={key}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-xs"
                        >
                          <span className="font-mono text-muted-foreground">{key}</span>
                          <span className="font-mono font-semibold tabular-nums text-foreground">
                            {fmt(value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}
          </>
        )}

        <SiteFooter className="mt-12" />
      </div>
    </div>
  )
}

function SectionLabel({
  icon: Icon,
  title,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Icon className="size-4 text-primary" aria-hidden />
      {title}
    </h3>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function MiniStat({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border border-border/70 bg-secondary/25 px-3 py-2.5", className)}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function BreakdownBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, n]) => n))
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No rows</p>
  }
  return (
    <ul className="space-y-2">
      {entries.map(([key, count]) => (
        <li key={key}>
          <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
            <span className="truncate capitalize text-muted-foreground">{key}</span>
            <span className="font-mono tabular-nums text-foreground">{count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function TrafficSparkline({
  points,
}: {
  points: Array<{ date: string; pageviews: number; visitors: number }>
}) {
  const max = Math.max(1, ...points.map((p) => p.visitors))
  return (
    <div className="flex h-20 items-end gap-0.5 overflow-x-auto rounded-xl border border-border/70 bg-secondary/20 px-2 py-2">
      {points.map((point) => (
        <div
          key={point.date}
          className="min-w-[6px] flex-1 rounded-sm bg-primary/70"
          style={{ height: `${Math.max(6, (point.visitors / max) * 100)}%` }}
          title={`${point.date}: ${point.visitors.toLocaleString()} visitors`}
        />
      ))}
    </div>
  )
}

function TrafficBreakdown({
  title,
  rows,
}: {
  title: string
  rows: Array<{ key: string; pageviews: number; visitors: number }>
}) {
  const max = Math.max(1, ...rows.map((row) => row.pageviews))
  if (rows.length === 0) {
    return (
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="text-xs text-muted-foreground">No data</p>
      </div>
    )
  }
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-mono text-muted-foreground" title={row.key}>
                {row.key}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-foreground">
                {row.pageviews.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary/60"
                style={{ width: `${Math.max(4, (row.pageviews / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatusPill({ value }: { value: boolean | string | null }) {
  if (typeof value === "boolean") {
    return (
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase",
          value ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive",
        )}
      >
        {value ? "yes" : "no"}
      </span>
    )
  }
  if (value == null) {
    return <span className="text-muted-foreground">—</span>
  }
  return <span className="max-w-[8rem] truncate font-mono text-foreground" title={value}>
    {value}
  </span>
}
