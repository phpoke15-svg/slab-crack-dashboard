"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Check, Loader2, Sparkles } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useEntitlements } from "@/components/billing/entitlements-provider"
import { PLAN_TIERS, type PriceKey } from "@/lib/billing/plans"
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/config"
import { cn } from "@/lib/utils"

export function PricingClient() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const entitlements = useEntitlements()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [interval, setInterval] = useState<"month" | "year">("month")

  const checkoutState = searchParams.get("checkout")

  useEffect(() => {
    if (checkoutState !== "success") return
    void entitlements.refresh()
    const id = window.setInterval(() => {
      void entitlements.refresh()
    }, 2500)
    const stop = window.setTimeout(() => window.clearInterval(id), 30_000)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(stop)
    }
  }, [checkoutState, entitlements])

  const start = async (priceKey: PriceKey) => {
    if (!user) {
      window.location.href = `/sign-in?next=${encodeURIComponent("/pricing")}`
      return
    }
    setBusyKey(priceKey)
    setError(null)
    try {
      const url = await entitlements.startCheckout(priceKey)
      if (url) window.location.href = url
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <CollecToolsBrand href="/" size="lg" subtitle="Plans · Premium & Pro" />
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            All tools stay free with ads. Upgrade for an ad-free experience, or Pro for Pokemon Center
            Queue Watch.
          </p>
        </div>
        <SiteAuthButton className="shrink-0" />
      </header>

      {checkoutState === "success" && (
        <p
          role="status"
          className="mb-6 rounded-xl border border-trade/40 bg-trade/10 px-4 py-3 text-sm text-foreground"
        >
          {entitlements.plan !== "free"
            ? `You're on ${entitlements.plan}. Thanks for supporting CollecTools.`
            : "Thanks — your subscription is activating. This page updates automatically for about 30 seconds."}
        </p>
      )}
      {checkoutState === "cancel" && (
        <p className="mb-6 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          Checkout canceled.{" "}
          <Link href="/" className="font-medium text-foreground hover:underline">
            Back to tools
          </Link>{" "}
          or pick a plan anytime.
        </p>
      )}

      <div
        className="mb-6 flex items-center justify-center gap-2"
        role="tablist"
        aria-label="Billing interval"
      >
        <button
          type="button"
          role="tab"
          aria-selected={interval === "month"}
          onClick={() => setInterval("month")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            interval === "month"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={interval === "year"}
          onClick={() => setInterval("year")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            interval === "year"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Yearly
          <span className="ml-1 text-[10px] font-normal opacity-80">save ~17%</span>
        </button>
      </div>

      {entitlements.plan !== "free" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
          <p className="text-sm text-foreground">
            Current plan:{" "}
            <span className="font-semibold capitalize">{entitlements.plan}</span>
            {entitlements.adFree ? " · Ad-free" : ""}
            {entitlements.queueWatch ? " · Queue Watch" : ""}
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
          className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {!user && (
        <p className="mb-4 text-center text-xs text-muted-foreground">
          Sign in required to subscribe.{" "}
          <Link
            href={`/sign-in?next=${encodeURIComponent("/pricing")}`}
            className="font-medium text-foreground hover:underline"
          >
            Sign in
          </Link>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {PLAN_TIERS.map((tier) => {
          const priceKey = `${tier.id}_${interval}` as PriceKey
          const price = interval === "month" ? tier.monthlyPrice : tier.yearlyPrice
          const isCurrent = entitlements.plan === tier.id
          const busy = busyKey === priceKey
          const billingReady = entitlements.stripeConfigured && !entitlements.isLoading

          return (
            <article
              key={tier.id}
              className={cn(
                "flex flex-col rounded-2xl border p-5",
                tier.id === "pro"
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card/60",
              )}
            >
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">{tier.name}</h2>
                {tier.id === "pro" && <Sparkles className="size-4 text-primary" />}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{tier.tagline}</p>
              <p className="mt-4 font-mono text-3xl font-bold text-foreground">
                ${price.toFixed(price % 1 === 0 ? 0 : 2)}
                <span className="text-sm font-medium text-muted-foreground">
                  /{interval === "month" ? "mo" : "yr"}
                </span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                aria-busy={busy}
                aria-disabled={isCurrent || !billingReady}
                disabled={busy || isCurrent || !billingReady}
                onClick={() => void start(priceKey)}
                className={cn(
                  "mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60",
                  tier.id === "pro"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-secondary/60 text-foreground hover:border-primary/40",
                )}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {isCurrent
                  ? "Current plan"
                  : entitlements.isLoading
                    ? "Loading…"
                    : !entitlements.stripeConfigured
                      ? "Subscriptions aren't open yet"
                      : `Choose ${tier.name}`}
              </button>
            </article>
          )
        })}
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
        Free forever includes SlabCrack and PokeMatch with ads.{" "}
        <Link href="/terms" className="hover:text-foreground">
          Terms
        </Link>
      </p>

      <SiteFooter className="mt-auto pt-12" />
    </div>
  )
}
