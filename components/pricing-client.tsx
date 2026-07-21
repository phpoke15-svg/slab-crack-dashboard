"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  Bookmark,
  Check,
  LayoutGrid,
  Loader2,
  Monitor,
  Smartphone,
  Zap,
} from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useEntitlements } from "@/components/billing/entitlements-provider"
import { PLAN_TIERS, FREE_PLAN_FEATURES, STARTER_PLAN, displayPlanFeatures, type PriceKey } from "@/lib/billing/plans"
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/config"
import { isNativeAppShell } from "@/lib/native-app"
import { cn } from "@/lib/utils"

const HIGHLIGHTS = [
  {
    icon: Zap,
    title: "Instant alerts",
    body: "Know the moment the Pokémon Center queue goes live.",
  },
  {
    icon: Monitor,
    title: "Web monitoring",
    body: "24/7 PokeWatch so you don’t have to sit and refresh.",
  },
  {
    icon: Smartphone,
    title: "Phone alerts",
    body: "Push notifications on your phone when it matters.",
  },
  {
    icon: Bookmark,
    title: "Bookmarklet",
    body: "One-click helper for monitoring from your browser.",
  },
] as const

function yearlySavePercent(monthly: number, yearly: number): number {
  const full = monthly * 12
  if (full <= 0) return 0
  return Math.round(((full - yearly) / full) * 100)
}

export function PricingClient() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const entitlements = useEntitlements()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [promotionCode, setPromotionCode] = useState("")
  const [promotionStatus, setPromotionStatus] = useState<{
    code: string
    label: string
  } | null>(null)
  const [promotionBusy, setPromotionBusy] = useState(false)

  const checkoutState = searchParams.get("checkout")
  const promoFromUrl = searchParams.get("promo")
  const refreshEntitlements = entitlements.refresh

  useEffect(() => {
    if (!promoFromUrl || promotionCode) return
    setPromotionCode(promoFromUrl.trim())
  }, [promoFromUrl, promotionCode])

  useEffect(() => {
    if (!promotionCode.trim() || promotionStatus?.code === promotionCode.trim()) return
    setPromotionStatus(null)
  }, [promotionCode, promotionStatus?.code])

  useEffect(() => {
    if (checkoutState !== "success") return
    void refreshEntitlements({ silent: true })
    const id = window.setInterval(() => {
      void refreshEntitlements({ silent: true })
    }, 2500)
    const stop = window.setTimeout(() => window.clearInterval(id), 30_000)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(stop)
    }
  }, [checkoutState, refreshEntitlements])

  const validatePromotionCode = async () => {
    const code = promotionCode.trim()
    if (!code) {
      setPromotionStatus(null)
      return true
    }

    setPromotionBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/billing/promo-code", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        code?: string
        label?: string
      } | null
      if (!res.ok || !data?.ok) {
        setPromotionStatus(null)
        setError(data?.error || "Promotion code could not be applied.")
        return false
      }
      setPromotionStatus({ code: data.code ?? code, label: data.label ?? "Discount applied" })
      return true
    } catch {
      setPromotionStatus(null)
      setError("Could not validate promotion code. Try again.")
      return false
    } finally {
      setPromotionBusy(false)
    }
  }

  const start = async (priceKey: PriceKey) => {
    if (!user) {
      const next = promotionCode.trim()
        ? `/pricing?promo=${encodeURIComponent(promotionCode.trim())}`
        : "/pricing"
      window.location.href = `/sign-in?next=${encodeURIComponent(next)}`
      return
    }
    setBusyKey(priceKey)
    setError(null)
    try {
      if (promotionCode.trim()) {
        const valid = await validatePromotionCode()
        if (!valid) return
      }
      const url = await entitlements.startCheckout(priceKey, promotionCode.trim() || undefined)
      if (url) {
        window.location.assign(url)
        return
      }
      setError("Checkout did not return a Stripe URL. Try again or contact support.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed")
    } finally {
      setBusyKey(null)
    }
  }

  const openPortal = async () => {
    setBusyKey("portal")
    setError(null)
    try {
      const url = await entitlements.openPortal()
      if (url) window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open billing portal")
    } finally {
      setBusyKey(null)
    }
  }

  const renewalLabel = entitlements.currentPeriodEnd
    ? new Date(entitlements.currentPeriodEnd).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null

  const premium = PLAN_TIERS.find((t) => t.id === "premium")!
  const pro = PLAN_TIERS.find((t) => t.id === "pro")!
  const stillBooting = entitlements.isLoading && !entitlements.stripeConfigured
  const billingReady = isNativeAppShell() || entitlements.stripeConfigured
  const nativeBilling = isNativeAppShell()

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.14_155_/_0.18),transparent_60%)]"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-10 flex items-start justify-between gap-4">
          <CollecToolsBrand href="/" size="lg" subtitle="PokeWatch · Pokémon Center alerts" />
          <SiteAuthButton className="shrink-0" />
        </header>

        {/* Hero */}
        <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Never miss a Pokémon Center{" "}
              <span className="text-primary">queue again.</span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              Get instant alerts the moment the Pokémon Center queue goes live. Included with{" "}
              <span className="font-medium text-foreground">CollecTools Pro</span>.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#plans"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
              >
                See Pro & Premium
              </a>
              <Link
                href="/pokewatch"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/50 px-5 text-sm font-semibold text-foreground transition-colors hover:bg-primary/10"
              >
                Learn about PokeWatch
              </Link>
            </div>
          </div>

          <HeroVisual />
        </section>

        {/* Feature highlights */}
        <section className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border/80 bg-card/50 px-4 py-4"
            >
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        {checkoutState === "success" && (
          <p
            role="status"
            className="mt-8 rounded-xl border border-trade/40 bg-trade/10 px-4 py-3 text-sm text-foreground"
          >
            {entitlements.plan !== "free"
              ? `You're on ${entitlements.plan}. Thanks for supporting CollecTools.`
              : "Thanks — your subscription is activating. This page updates automatically for about 30 seconds."}
          </p>
        )}
        {checkoutState === "cancel" && (
          <p className="mt-8 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
            Checkout canceled.{" "}
            <Link href="/" className="font-medium text-foreground hover:underline">
              Back to tools
            </Link>{" "}
            or pick a plan anytime.
          </p>
        )}

        {entitlements.plan !== "free" && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
            <p className="text-sm text-foreground">
              Current plan:{" "}
              <span className="font-semibold capitalize">{entitlements.plan}</span>
              {entitlements.adFree ? " · Ad-free" : ""}
              {entitlements.queueWatch ? " · PokeWatch" : ""}
              {entitlements.cancelAtPeriodEnd && renewalLabel
                ? ` · Cancels ${renewalLabel}`
                : renewalLabel
                  ? ` · Renews ${renewalLabel}`
                  : ""}
            </p>
            <button
              type="button"
              onClick={() => void openPortal()}
              disabled={busyKey === "portal"}
              className="text-sm font-medium text-primary hover:underline disabled:opacity-60"
            >
              Manage billing
            </button>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-destructive/50 bg-destructive/15 px-4 py-3 text-sm font-medium text-destructive"
          >
            {error}
          </p>
        )}

        {nativeBilling && (
          <p className="mt-6 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
            Subscriptions in the iOS app use Apple In-App Purchase. Tap a plan below to subscribe through
            the App Store. Manage renewals in Settings → Apple ID → Subscriptions.
          </p>
        )}

        {/* Plans */}
        <section id="plans" className="mt-12 scroll-mt-8 space-y-5">
          <div className="rounded-2xl border border-border/80 bg-card/40 p-4 sm:p-5">
            <label htmlFor="promotion-code" className="text-sm font-semibold text-foreground">
              Promotion code
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter your code here before checkout. Discount codes replace the 7-day free trial so the
              savings show up immediately on Stripe.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="promotion-code"
                value={promotionCode}
                onChange={(event) => setPromotionCode(event.target.value)}
                placeholder="collectools"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none ring-primary/40 focus:ring-2"
              />
              <button
                type="button"
                onClick={() => void validatePromotionCode()}
                disabled={promotionBusy || !promotionCode.trim()}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/40 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 disabled:opacity-60"
              >
                {promotionBusy ? <Loader2 className="size-4 animate-spin" /> : "Apply code"}
              </button>
            </div>
            {promotionStatus ? (
              <p className="mt-2 text-sm text-primary">
                {promotionStatus.code} applied — {promotionStatus.label}
              </p>
            ) : null}
          </div>

          <PlanSpotlight
            badge="PRO"
            name="CollecTools Pro"
            tagline={pro.tagline}
            features={displayPlanFeatures(pro.features)}
            monthly={pro.monthlyPrice}
            yearly={pro.yearlyPrice}
            featured
            isCurrent={entitlements.plan === "pro"}
            busyMonth={busyKey === "pro_month"}
            busyYear={busyKey === "pro_year"}
            stillBooting={stillBooting}
            billingReady={billingReady}
            onStartMonth={() => void start("pro_month")}
            onStartYear={() => void start("pro_year")}
          />

          <PlanSpotlight
            badge="PREMIUM"
            name="CollecTools Premium"
            tagline={premium.tagline}
            features={displayPlanFeatures(premium.features)}
            monthly={premium.monthlyPrice}
            yearly={premium.yearlyPrice}
            featured={false}
            isCurrent={entitlements.plan === "premium"}
            busyMonth={busyKey === "premium_month"}
            busyYear={busyKey === "premium_year"}
            stillBooting={stillBooting}
            billingReady={billingReady}
            onStartMonth={() => void start("premium_month")}
            onStartYear={() => void start("premium_year")}
          />

          <article className="rounded-2xl border border-border/70 bg-card/30 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {STARTER_PLAN.name}
                </p>
                <h2 className="mt-1 text-xl font-bold text-foreground">Start with a preview</h2>
                <p className="mt-1 text-sm text-muted-foreground">{STARTER_PLAN.tagline}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {FREE_PLAN_FEATURES.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href="/slablabs/slabcrack"
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/50 px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40"
              >
                Try SlabCrack free
              </Link>
            </div>
          </article>
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <a href="#plans" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <LayoutGrid className="size-3.5" aria-hidden="true" />
            Compare plans
          </a>
          {!user ? (
            <Link
              href={`/sign-in?next=${encodeURIComponent("/pricing")}`}
              className="hover:text-foreground"
            >
              Sign in
            </Link>
          ) : null}
        </div>

        {!entitlements.stripeConfigured && !entitlements.isLoading && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Questions?{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="hover:text-foreground">
              {LEGAL_CONTACT_EMAIL}
            </a>
          </p>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Paid plans include a 7-day free trial. Cancel anytime.{" "}
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </p>

        <SiteFooter className="mt-auto pt-12" />
      </div>
    </div>
  )
}

function PlanSpotlight({
  badge,
  name,
  tagline,
  features,
  monthly,
  yearly,
  featured,
  isCurrent,
  busyMonth,
  busyYear,
  stillBooting,
  billingReady,
  onStartMonth,
  onStartYear,
}: {
  badge: string
  name: string
  tagline: string
  features: string[]
  monthly: number
  yearly: number
  featured: boolean
  isCurrent: boolean
  busyMonth: boolean
  busyYear: boolean
  stillBooting: boolean
  billingReady: boolean
  onStartMonth: () => void
  onStartYear: () => void
}) {
  const save = yearlySavePercent(monthly, yearly)
  const monthLabel = `$${monthly.toFixed(2)}`
  const yearLabel = `$${yearly.toFixed(2)}`

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-card/60",
        featured ? "border-primary/60 shadow-[0_0_0_1px_oklch(0.78_0.17_155_/_0.15)]" : "border-border",
      )}
    >
      <div className="grid lg:grid-cols-2">
        <div className="border-b border-border p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <span
            className={cn(
              "inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              featured
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-secondary/60 text-muted-foreground",
            )}
          >
            {badge}
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {name}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{tagline}</p>
          <ul className="mt-6 space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex gap-2.5 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            7-day free trial
          </p>
          <p className="mt-2 font-mono text-4xl font-bold tracking-tight text-foreground">
            {monthLabel}
            <span className="text-base font-medium text-muted-foreground"> / month</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Cancel anytime</p>

          <button
            type="button"
            aria-busy={busyMonth || stillBooting}
            disabled={busyMonth || isCurrent || !billingReady}
            onClick={onStartMonth}
            className={cn(
              "mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-60",
              featured
                ? "bg-primary text-primary-foreground hover:brightness-110"
                : "border border-primary/50 bg-primary/10 text-foreground hover:bg-primary/15",
            )}
          >
            {busyMonth ? <Loader2 className="size-4 animate-spin" /> : null}
            {isCurrent
              ? "Current plan"
              : stillBooting
                ? "Loading…"
                : !billingReady
                  ? "Subscriptions aren't open yet"
                  : `Start 7-day free trial — ${monthLabel}/mo`}
          </button>

          <button
            type="button"
            aria-busy={busyYear || stillBooting}
            disabled={busyYear || isCurrent || !billingReady}
            onClick={onStartYear}
            className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary/40 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 disabled:opacity-60"
          >
            {busyYear ? <Loader2 className="size-4 animate-spin" /> : null}
            {isCurrent
              ? "Current plan"
              : `Start annual trial — ${yearLabel}/yr`}
            {!isCurrent && save > 0 ? (
              <span className="text-primary">[Save {save}%]</span>
            ) : null}
          </button>
        </div>
      </div>
    </article>
  )
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xs lg:mr-0 lg:ml-auto">
      <div className="rounded-[1.75rem] border border-border bg-card p-2.5 shadow-xl shadow-black/50">
        <div className="rounded-[1.25rem] border border-border/70 bg-background px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground">9:41</span>
            <span className="flex gap-0.5">
              <span className="size-1 rounded-full bg-muted-foreground/50" />
              <span className="size-1 rounded-full bg-muted-foreground/50" />
              <span className="size-1 rounded-full bg-muted-foreground/50" />
            </span>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-card/80 px-3 py-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
              CT
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Queue Alert!</p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                Pokémon Center is live.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
