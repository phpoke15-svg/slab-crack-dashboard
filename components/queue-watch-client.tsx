"use client"

import Link from "next/link"
import { Bell, Loader2, Lock, Smartphone } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { PushAlertsOptIn } from "@/components/push-alerts-opt-in"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useEntitlements } from "@/components/billing/entitlements-provider"

export function QueueWatchClient() {
  const { user, isLoading: authLoading } = useAuth()
  const entitlements = useEntitlements()
  const hasPro = entitlements.queueWatch
  const loading = authLoading || entitlements.isLoading

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <CollecToolsBrand href="/" size="lg" subtitle="PokeWatch · Pokemon Center alerts" />
        </div>
        <SiteAuthButton className="shrink-0" />
      </header>

      <section className="mb-8 rounded-2xl border border-border bg-card/60 p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <Smartphone className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">What is PokeWatch?</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              PokeWatch watches the Pokemon Center website for you during drop windows. When the
              virtual queue goes live, we send a push notification to your phone so you can open the
              site and get in line — without keeping a tab open or refreshing all day.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Alerts go out to CollecTools Pro and Supreme members who turn notifications on below.
              One member detecting the queue can notify everyone opted in.
            </p>
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
              <strong className="text-foreground">Use at your own risk.</strong> Pokemon Center may
              change how queues work at any time. PokeWatch is a helper, not a guarantee of access.
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <section role="status" className="mb-8 rounded-2xl border border-border bg-card/40 p-6">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking your plan…
          </div>
        </section>
      ) : (
        <PushAlertsOptIn
          variant="hero"
          queueOnly
          defaultQueueLive
          defaultWalmartWednesday={false}
        />
      )}

      {!loading && !hasPro ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {entitlements.plan === "premium"
            ? "Premium includes full SlabCrack ad-free — upgrade to Pro for PokeWatch alerts."
            : "PokeWatch is included with CollecTools Pro ($9.99/mo, 7-day trial)."}
          {!user ? (
            <>
              {" "}
              <Link href={`/sign-in?next=${encodeURIComponent("/pokewatch")}`} className="text-primary hover:underline">
                Sign in
              </Link>{" "}
              to manage your plan.
            </>
          ) : (
            <>
              {" "}
              <Link href="/pricing" className="text-primary hover:underline">
                Compare plans
              </Link>
            </>
          )}
        </p>
      ) : null}

      {!loading && hasPro ? (
        <section className="mt-6 rounded-2xl border border-border bg-card/40 p-5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Bell className="size-4 text-primary" />
            After you enable alerts
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Keep notifications allowed for this site in your browser or phone settings.</li>
            <li>
              On iPhone, add CollecTools to your Home Screen first, then enable alerts from that icon.
            </li>
            <li>When you get a queue-live alert, open Pokemon Center right away to join the line.</li>
          </ul>
          <a
            href="https://www.pokemoncenter.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Open Pokemon Center
          </a>
        </section>
      ) : null}

      <SiteFooter className="mt-auto pt-10" />
    </div>
  )
}
