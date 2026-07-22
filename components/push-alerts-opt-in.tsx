"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bell, BellOff, Loader2, Lock, Smartphone } from "lucide-react"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useEntitlements } from "@/components/billing/entitlements-provider"
import {
  isNativeAppShell,
  isNativePushEnabledInWebView,
  requestNativePushRegistration,
} from "@/lib/native-app"
import {
  disableWebPush,
  enableWebPush,
  fetchServerPushStatus,
  getPushPermission,
  hasActivePushSubscription,
  isPushPermissionDenied,
  isWebPushSupported,
  resyncWebPushSubscription,
} from "@/lib/push/client"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** Highlight queue vs Walmart depending on page context */
  defaultQueueLive?: boolean
  defaultWalmartWednesday?: boolean
  compact?: boolean
  /** PokeWatch page: single primary button, queue alerts only */
  queueOnly?: boolean
  /** Large CTA card with upgrade path for non-Pro tiers */
  variant?: "default" | "hero"
}

export function PushAlertsOptIn({
  className,
  defaultQueueLive = true,
  defaultWalmartWednesday = true,
  compact = false,
  queueOnly = false,
  variant = "default",
}: Props) {
  const { user, isLoading: authLoading } = useAuth()
  const entitlements = useEntitlements()
  const hasPro = entitlements.queueWatch
  const isSupreme = entitlements.supreme
  const isHero = variant === "hero"

  const [supported, setSupported] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queueLive, setQueueLive] = useState(defaultQueueLive)
  const [walmartWednesday, setWalmartWednesday] = useState(defaultWalmartWednesday)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [nativeShell, setNativeShell] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const refresh = useCallback(async () => {
    const shell = isNativeAppShell()
    setNativeShell(shell)
    setSupported(isWebPushSupported())
    if (shell) {
      setEnabled(isNativePushEnabledInWebView())
      return
    }
    const permission = await getPushPermission()
    if (permission === "unsupported") {
      setSupported(false)
      setEnabled(false)
      setPermissionDenied(false)
      return
    }
    setPermissionDenied(permission === "denied" || isPushPermissionDenied())
    const browserEnabled = await hasActivePushSubscription()
    setEnabled(browserEnabled)

    if (browserEnabled && user && hasPro) {
      const server = await fetchServerPushStatus()
      if (server?.signedIn && !server.queueLiveOnServer) {
        const sync = await resyncWebPushSubscription({
          queueLive: queueOnly ? true : queueLive,
          walmartWednesday: queueOnly ? false : walmartWednesday,
          socialAlerts: Boolean(user),
          priceAlerts: Boolean(user),
        })
        if (!sync.ok) {
          setError(sync.error)
        }
      }
    }
  }, [user, hasPro, queueLive, walmartWednesday, queueOnly])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!nativeShell) return
    const timer = setInterval(() => {
      setEnabled(isNativePushEnabledInWebView())
    }, 800)
    return () => clearInterval(timer)
  }, [nativeShell])

  useEffect(() => {
    if (!authLoading && isSupreme) {
      setQueueLive(true)
      if (!queueOnly) setWalmartWednesday(true)
      return
    }
    if (!authLoading && (!user || !hasPro) && queueLive) {
      setQueueLive(false)
    }
  }, [authLoading, user, hasPro, isSupreme, queueLive, queueOnly])

  const onEnableNative = () => {
    setBusy(true)
    setError(null)
    if (!requestNativePushRegistration()) {
      setBusy(false)
      setError("Could not reach the CollecTools app. Update to the latest app version.")
      return
    }
    setTimeout(() => {
      setBusy(false)
      setEnabled(isNativePushEnabledInWebView())
    }, 1200)
  }

  const onEnable = async () => {
    setBusy(true)
    setError(null)

    if (queueLive && !user) {
      setBusy(false)
      setError("Sign in to get Pokémon Center queue alerts.")
      return
    }
    if (queueLive && !hasPro) {
      setBusy(false)
      setError("Pokémon Center queue alerts require CollecTools Pro.")
      return
    }

    const result = await enableWebPush({
      queueLive: queueOnly ? true : queueLive,
      walmartWednesday: queueOnly ? false : walmartWednesday,
      socialAlerts: Boolean(user),
      priceAlerts: Boolean(user),
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setEnabled(true)
  }

  const onDisable = async () => {
    setBusy(true)
    setError(null)
    await disableWebPush()
    setBusy(false)
    setEnabled(false)
  }

  const upgradeToPro = async () => {
    if (!user) {
      window.location.href = `/sign-in?next=${encodeURIComponent("/pokewatch")}`
      return
    }
    setCheckoutBusy(true)
    setError(null)
    try {
      const url = await entitlements.startCheckout("pro_month")
      if (url) window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed")
    } finally {
      setCheckoutBusy(false)
    }
  }

  if (nativeShell) {
    if (isHero && !hasPro) {
      return (
        <section
          className={cn(
            "rounded-2xl border border-primary/40 bg-primary/10 p-6 text-center",
            className,
          )}
        >
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary">
            <Lock className="size-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-foreground">Queue live push alerts</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Instant queue alerts through the CollecTools app. Included with Pro and Supreme.
          </p>
          <button
            type="button"
            disabled={checkoutBusy || (user && !entitlements.stripeConfigured)}
            onClick={() => void upgradeToPro()}
            className="mt-5 inline-flex min-w-[220px] items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            Upgrade to Pro for access
          </button>
        </section>
      )
    }

    const nativeTitle = enabled ? "Native queue alerts enabled" : "Turn on queue alerts"
    const nativeSubtitle = enabled
      ? "You’ll get an instant app push when the Pokemon Center queue goes live."
      : "Allow notifications on this phone. Alerts are delivered by the CollecTools app (Firebase), not browser Web Push."

    return (
      <section
        className={cn(
          "rounded-2xl border bg-card/60 p-6 text-center",
          isHero ? "border-primary/40 bg-primary/5" : "border-border p-5",
          className,
        )}
      >
        <p className="flex items-center justify-center gap-2 text-base font-semibold text-foreground">
          {enabled ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4" />}
          {nativeTitle}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{nativeSubtitle}</p>
        {!enabled ? (
          <button
            type="button"
            disabled={busy || authLoading || !user || !hasPro}
            onClick={onEnableNative}
            className="mt-5 inline-flex min-w-[220px] items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
            Enable queue alerts
          </button>
        ) : (
          <p className="mt-4 text-xs font-medium text-trade">Enabled on this device</p>
        )}
        {!user ? (
          <p className="mt-3 text-xs text-muted-foreground">
            <Link href={`/sign-in?next=${encodeURIComponent("/pokewatch")}`} className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            with Pro or Supreme first.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </section>
    )
  }

  if (!supported) {
    return (
      <section className={cn("rounded-2xl border border-border bg-card/60 p-5", className)}>
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Smartphone className="size-4" />
          {isHero ? "Queue alerts" : "Phone alerts"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Web Push isn&apos;t available in this browser. On iPhone/iPad: Safari → Share → Add to Home
          Screen, open CollecTools from the icon, then enable alerts here.
        </p>
      </section>
    )
  }

  if (isHero && !hasPro) {
    return (
      <section
        className={cn(
          "rounded-2xl border border-primary/40 bg-primary/10 p-6 text-center",
          className,
        )}
      >
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary">
          <Lock className="size-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Queue live push alerts</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Get notified on your phone the moment the Pokemon Center virtual queue opens. Included with
          CollecTools Pro and Supreme.
        </p>
        <button
          type="button"
          disabled={checkoutBusy || (user && !entitlements.stripeConfigured)}
          onClick={() => void upgradeToPro()}
          className="mt-5 inline-flex min-w-[220px] items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {checkoutBusy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Starting…
            </>
          ) : !user ? (
            "Upgrade to Pro for access"
          ) : !entitlements.stripeConfigured ? (
            "Billing coming soon"
          ) : (
            "Upgrade to Pro for access"
          )}
        </button>
        {!user ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Already on Pro?{" "}
            <Link href={`/sign-in?next=${encodeURIComponent("/pokewatch")}`} className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        ) : (
          <Link
            href="/pricing"
            className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
          >
            Compare plans
          </Link>
        )}
        {error ? (
          <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </section>
    )
  }

  const heroTitle = enabled ? "Queue alerts enabled" : "Turn on queue alerts"
  const heroSubtitle = enabled
    ? "You’ll get a push when the Pokemon Center queue goes live."
    : "Allow notifications on this device to receive queue-live alerts."

  return (
    <section
      className={cn(
        "rounded-2xl border bg-card/60 p-5",
        isHero ? "border-primary/40 bg-primary/5 p-6 text-center" : "border-border",
        className,
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 text-sm font-semibold text-foreground",
          isHero && "justify-center text-base",
        )}
      >
        {enabled ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4" />}
        {isHero ? heroTitle : "Phone alerts"}
      </p>
      {isHero ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{heroSubtitle}</p>
      ) : !compact ? (
        <p className="mt-2 text-sm text-muted-foreground">
          When <strong className="font-medium text-foreground">any</strong> Pro or Supreme member
          detects the Pokémon Center queue live, <strong className="font-medium text-foreground">all</strong>{" "}
          Pro and Supreme members who enabled phone alerts get a push. Supreme accounts always receive
          every alert type (queue live, drop guard, Walmart Wednesday). Wednesday 9pm ET Walmart
          reminders are separate for everyone else.
        </p>
      ) : null}

      {!enabled && !isHero && (
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={queueLive}
              disabled={!user || !hasPro}
              onChange={(e) => setQueueLive(e.target.checked)}
              className="size-4 rounded border-border disabled:opacity-50"
            />
            <span>
              Pokémon Center queue live{" "}
              <span className="text-xs">(Pro / Supreme)</span>
            </span>
          </label>
          {!user && (
            <p className="pl-6 text-xs">
              <Link href="/pricing" className="text-primary hover:underline">
                Sign in
              </Link>{" "}
              with Pro to enable queue alerts.
            </p>
          )}
          {isSupreme && (
            <p className="pl-6 text-xs text-primary">
              Supreme: all phone alert types are enabled automatically on this device.
            </p>
          )}
          {user && !hasPro && !isSupreme && (
            <p className="pl-6 text-xs">
              <Link href="/pricing" className="text-primary hover:underline">
                Upgrade to Pro
              </Link>{" "}
              for queue-live pushes.
            </p>
          )}
          {!queueOnly && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={walmartWednesday}
                onChange={(e) => setWalmartWednesday(e.target.checked)}
                className="size-4 rounded border-border"
              />
              Walmart Wednesday 9pm ET
            </label>
          )}
        </div>
      )}

      <div className={cn("mt-4 flex flex-wrap gap-2", isHero && "justify-center")}>
        {enabled ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDisable()}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-50",
              isHero && "min-w-[220px] justify-center px-5 py-3",
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <BellOff className="size-4" />}
            {isHero ? "Turn off queue alerts" : "Turn off phone alerts"}
          </button>
        ) : (
          <button
            type="button"
            disabled={
              busy ||
              authLoading ||
              (!isHero && !queueLive && !walmartWednesday) ||
              (isHero && !user)
            }
            onClick={() => void onEnable()}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50",
              isHero && "min-w-[220px] justify-center px-5 py-3 font-semibold",
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
            {isHero
              ? user
                ? "Enable queue alerts"
                : "Sign in to enable alerts"
              : "Enable phone alerts"}
          </button>
        )}
      </div>

      {isHero && !user && !enabled ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <Link href={`/sign-in?next=${encodeURIComponent("/pokewatch")}`} className="text-primary hover:underline">
            Sign in
          </Link>{" "}
          with a Pro or Supreme account.
        </p>
      ) : null}

      {enabled && (
        <p className={cn("mt-3 text-xs font-medium text-trade", isHero && "text-center")}>
          Enabled on this device
        </p>
      )}
      {permissionDenied && !enabled ? (
        <p className={cn("mt-3 text-sm text-muted-foreground", isHero && "text-center")}>
          Notifications are blocked in your browser for this site. Use the lock or tune icon in the
          address bar, set Notifications to <strong className="font-medium text-foreground">Allow</strong>,
          reload the page, then tap enable again.
        </p>
      ) : null}

      {error && (
        <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
