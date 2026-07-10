"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Bell,
  BellRing,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  Radio,
  ShieldAlert,
  Zap,
} from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { PushAlertsOptIn } from "@/components/push-alerts-opt-in"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useEntitlements } from "@/components/billing/entitlements-provider"
import { buildQueueWatchBookmarklet, buildQueueWatchConsoleSnippet } from "@/lib/pokemon-center/bookmarklet"
import { cn } from "@/lib/utils"

const SESSION_KEY = "pc-queue-watch-session"
const TOKEN_KEY = "pc-queue-watch-token"
const POLL_MS = 4_000

type StatusResponse = {
  live: boolean
  confidence: number
  source: string
  server: { live: boolean; blocked?: boolean; signals: Array<{ label: string }> }
  bookmarklet: {
    live: boolean
    pageUrl?: string
    reportedAt?: string
    fresh?: boolean
  } | null
  checkedAt: string
  guidance?: string | null
}

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `pcw-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function QueueWatchClient() {
  const { user, isLoading: authLoading } = useAuth()
  const entitlements = useEntitlements()
  const [sessionId, setSessionId] = useState("")
  const [watchToken, setWatchToken] = useState("")
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [monitoring, setMonitoring] = useState(true)
  const [notifications, setNotifications] = useState<NotificationPermission>("default")
  const [copied, setCopied] = useState(false)
  const [copiedConsole, setCopiedConsole] = useState(false)
  const [showBookmarkCode, setShowBookmarkCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const previousLive = useRef(false)

  const hasPro = entitlements.queueWatch

  const playAlertTone = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = "square"
      oscillator.frequency.value = 880
      gain.gain.value = 0.08
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start()
      window.setTimeout(() => {
        oscillator.stop()
        void ctx.close()
      }, 280)
    } catch {
      // ignore audio errors
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY)
    setSessionId(stored ?? createSessionId())
    const storedToken = localStorage.getItem(TOKEN_KEY)
    if (storedToken) setWatchToken(storedToken)
    if (typeof Notification !== "undefined") setNotifications(Notification.permission)
  }, [])

  useEffect(() => {
    if (!sessionId) return
    localStorage.setItem(SESSION_KEY, sessionId)
  }, [sessionId])

  useEffect(() => {
    if (!hasPro || !user) {
      setWatchToken("")
      localStorage.removeItem(TOKEN_KEY)
      return
    }

    let cancelled = false
    setTokenError(null)
    void fetch("/api/billing/queue-watch-token", {
      method: "POST",
      credentials: "same-origin",
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { token?: string; error?: string } | null
        if (cancelled) return
        if (!res.ok || !data?.token) {
          setTokenError(data?.error || "Could not mint bookmarklet token. Is CRON_SECRET set on Vercel?")
          return
        }
        setWatchToken(data.token)
        localStorage.setItem(TOKEN_KEY, data.token)
      })
      .catch(() => {
        if (!cancelled) setTokenError("Could not mint bookmarklet token.")
      })

    return () => {
      cancelled = true
    }
  }, [hasPro, user?.id])

  const bookmarkletHref = useMemo(() => {
    if (!sessionId || !watchToken || typeof window === "undefined") return ""
    return buildQueueWatchBookmarklet({
      origin: window.location.origin,
      sessionId,
      token: watchToken,
    })
  }, [sessionId, watchToken])

  const consoleSnippet = useMemo(() => {
    if (!sessionId || !watchToken || typeof window === "undefined") return ""
    return buildQueueWatchConsoleSnippet({
      origin: window.location.origin,
      sessionId,
      token: watchToken,
    })
  }, [sessionId, watchToken])

  const notifyLive = useCallback(async () => {
    if (typeof window === "undefined") return
    try {
      playAlertTone()
    } catch {
      // ignore
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Pokemon Center queue is LIVE", {
        body: "Open Pokemon Center now to join the virtual queue.",
        icon: "/icon.svg",
        tag: "pc-queue-live",
        requireInteraction: true,
      })
    }
  }, [playAlertTone])

  const poll = useCallback(async () => {
    if (!sessionId || !hasPro) return
    try {
      const tokenQs = watchToken ? `&token=${encodeURIComponent(watchToken)}` : ""
      const response = await fetch(
        `/api/pokemon-center/status?sessionId=${encodeURIComponent(sessionId)}${tokenQs}`,
        { cache: "no-store", credentials: "same-origin" },
      )
      if (response.status === 403) {
        setError("Queue Watch requires a Pro subscription.")
        setMonitoring(false)
        return
      }
      if (!response.ok) throw new Error("Status check failed")
      const data = (await response.json()) as StatusResponse
      setStatus(data)
      setError(null)

      if (data.live && !previousLive.current) {
        void notifyLive()
      }
      previousLive.current = data.live
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check queue status")
    } finally {
      setLoading(false)
    }
  }, [hasPro, notifyLive, sessionId, watchToken])

  useEffect(() => {
    if (!hasPro || !monitoring || !sessionId) {
      setLoading(false)
      return
    }
    void poll()
    const id = window.setInterval(() => void poll(), POLL_MS)
    return () => window.clearInterval(id)
  }, [hasPro, monitoring, poll, sessionId])

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") {
      setError("Desktop notifications are not supported in this browser.")
      return
    }
    const permission = await Notification.requestPermission()
    setNotifications(permission)
  }

  const copyBookmarklet = async () => {
    if (!bookmarkletHref) return
    await navigator.clipboard.writeText(bookmarkletHref)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2500)
  }

  const copyConsoleSnippet = async () => {
    if (!consoleSnippet) return
    await navigator.clipboard.writeText(consoleSnippet)
    setCopiedConsole(true)
    window.setTimeout(() => setCopiedConsole(false), 2500)
  }

  const openPokemonCenter = () => {
    window.open("https://www.pokemoncenter.com/", "_blank", "noopener,noreferrer")
  }

  const upgradeToPro = async (priceKey: "pro_month" | "pro_year") => {
    if (!user) {
      window.location.href = `/sign-in?next=${encodeURIComponent("/queue-watch")}`
      return
    }
    setCheckoutBusy(true)
    try {
      const url = await entitlements.startCheckout(priceKey)
      if (url) window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed")
    } finally {
      setCheckoutBusy(false)
    }
  }

  const live = status?.live ?? false
  const bookmarkletActive = Boolean(status?.bookmarklet?.fresh ?? status?.bookmarklet?.reportedAt)
  const tabConnected = Boolean(status?.bookmarklet?.fresh)
  const guidance = status?.guidance

  const sourceLabel =
    status?.source === "bookmarklet"
      ? "your Pokemon Center tab"
      : status?.source === "blocked"
        ? "server blocked (ignored)"
        : status?.source === "idle"
          ? "waiting for tab monitor"
          : "soft server probe"

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <CollecToolsBrand href="/" size="lg" subtitle="Queue Watch · Pokemon Center alerts" />
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Get instant alerts when Pokemon Center&apos;s virtual queue goes live. Included with{" "}
            <Link href="/pricing" className="font-medium text-primary hover:underline">
              CollecTools Pro
            </Link>
            .
          </p>
        </div>
        <SiteAuthButton className="shrink-0" />
      </header>

      {authLoading || entitlements.isLoading ? (
        <section
          role="status"
          className="mb-8 rounded-2xl border border-border bg-card/40 p-6"
        >
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking your plan…
          </div>
        </section>
      ) : !hasPro ? (
        <section className="mb-8 rounded-2xl border border-primary/40 bg-primary/10 p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary">
              <Lock className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-foreground">Pro feature</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Queue Watch (web monitoring, bookmarklet, and phone alerts) is part of{" "}
                <strong className="text-foreground">Pro</strong> — $9.99/mo or $99.99/yr, with a
                7-day free trial.
                {entitlements.plan === "premium"
                  ? " You’re on Premium (full SlabCrack, ad-free) — upgrade to Pro to unlock Queue Watch."
                  : " Premium ($4.99/mo) unlocks full SlabCrack ad-free but does not include Queue Watch."}
              </p>
              {error ? (
                <p
                  role="alert"
                  className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={checkoutBusy || !entitlements.stripeConfigured}
                  onClick={() => void upgradeToPro("pro_month")}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {checkoutBusy ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Starting…
                    </span>
                  ) : !entitlements.stripeConfigured ? (
                    "Billing coming soon"
                  ) : (
                    "Start 7-day Pro trial — $9.99/mo"
                  )}
                </button>
                <button
                  type="button"
                  disabled={checkoutBusy || !entitlements.stripeConfigured}
                  onClick={() => void upgradeToPro("pro_year")}
                  className="rounded-xl border border-border bg-card/60 px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {checkoutBusy ? "…" : "Start annual trial — $99.99/yr"}
                </button>
                <Link
                  href="/pricing"
                  className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-medium text-primary hover:underline"
                >
                  Compare plans
                </Link>
                {!user ? (
                  <Link
                    href={`/sign-in?next=${encodeURIComponent("/queue-watch")}`}
                    className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    Sign in
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {hasPro ? (
        <>
          <section
            className={cn(
              "mb-6 rounded-2xl border p-5 transition-colors",
              live
                ? "border-trade bg-trade/10 shadow-[0_0_40px_-12px] shadow-trade/40"
                : "border-border bg-card/60",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Queue status
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-foreground">
                  {loading && !status ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-5 animate-spin" /> Checking…
                    </span>
                  ) : live ? (
                    "Queue is LIVE"
                  ) : tabConnected ? (
                    "No queue detected"
                  ) : (
                    "Tab monitor offline"
                  )}
                </h1>
                {status && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Source: {sourceLabel}
                    {status.confidence > 0 && ` · ${status.confidence}% confidence`}
                  </p>
                )}
                {guidance ? (
                  <p className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                    <span>{guidance}</span>
                  </p>
                ) : null}
              </div>
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-xl border",
                  live
                    ? "border-trade bg-trade/20 text-trade"
                    : "border-border bg-secondary text-muted-foreground",
                )}
              >
                {live ? <Zap className="size-6" /> : <Radio className="size-6" />}
              </span>
            </div>

            {live && (
              <button
                type="button"
                onClick={openPokemonCenter}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-trade px-4 py-2.5 text-sm font-semibold text-background transition-colors hover:brightness-110"
              >
                Open Pokemon Center <ExternalLink className="size-4" />
              </button>
            )}
          </section>

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setMonitoring((value) => !value)
                if (!monitoring) void poll()
              }}
              className={cn(
                "rounded-2xl border px-4 py-4 text-left transition-colors",
                monitoring
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card/60 hover:border-primary/40",
              )}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {monitoring ? (
                  <BellRing className="size-4 text-primary" />
                ) : (
                  <Bell className="size-4" />
                )}
                {monitoring ? "Monitoring active" : "Start monitoring"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reads your tab monitor every {POLL_MS / 1000}s — does not hit Pokemon Center from
                Vercel.
              </p>
            </button>

            <button
              type="button"
              onClick={() => void requestNotifications()}
              className="rounded-2xl border border-border bg-card/60 px-4 py-4 text-left transition-colors hover:border-primary/40"
            >
              <p className="text-sm font-semibold text-foreground">Desktop notifications</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {notifications === "granted"
                  ? "Enabled — you’ll get an alert when the queue flips live."
                  : notifications === "denied"
                    ? "Blocked in browser settings."
                    : "Click to allow browser alerts."}
              </p>
            </button>
          </div>

          {error && (
            <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <section className="mb-6 rounded-2xl border border-primary/40 bg-primary/5 p-5">
            <h2 className="text-base font-semibold text-foreground">
              1. Install the tab monitor (required)
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This is a <strong className="text-foreground">bookmarklet</strong> (JavaScript), not a
              normal website link. If the bookmark URL doesn&apos;t start with{" "}
              <code className="rounded bg-secondary px-1 text-xs">javascript:</code>, Chrome treats it
              as a Google search.
            </p>

            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                Show your bookmarks bar: <kbd className="rounded bg-secondary px-1">Ctrl+Shift+B</kbd>{" "}
                (Windows) or <kbd className="rounded bg-secondary px-1">Cmd+Shift+B</kbd> (Mac).
              </li>
              <li>
                Right-click the bookmarks bar → <strong className="text-foreground">Add page</strong>{" "}
                / <strong className="text-foreground">Add bookmark</strong>.
              </li>
              <li>
                Name: <strong className="text-foreground">PC Queue Watch</strong>
              </li>
              <li>
                URL field: click <strong className="text-foreground">Copy bookmarklet</strong> below,
                paste into URL.{" "}
                <strong className="text-foreground">
                  Check it starts with javascript:
                </strong>{" "}
                If Chrome removed that word, type <code className="rounded bg-secondary px-1 text-xs">javascript:</code>{" "}
                at the very beginning, then paste again.
              </li>
              <li>
                Open <strong className="text-foreground">pokemoncenter.com</strong>, pass any bot
                check, then click your new bookmark (on that tab — not from Google).
              </li>
              <li>
                Allow the CollecTools pop-up if asked. You should see{" "}
                <strong className="text-foreground">PC Queue Watch active</strong> in the corner.
              </li>
            </ol>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copyBookmarklet()}
                disabled={!bookmarkletHref}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied
                  ? "Copied — paste into bookmark URL"
                  : bookmarkletHref
                    ? "Copy bookmarklet"
                    : "Preparing secure bookmarklet…"}
              </button>
              <button
                type="button"
                onClick={() => setShowBookmarkCode((v) => !v)}
                disabled={!bookmarkletHref}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {showBookmarkCode ? "Hide code" : "Show code"}
              </button>
              <button
                type="button"
                onClick={openPokemonCenter}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium"
              >
                Open Pokemon Center <ExternalLink className="size-4" />
              </button>
            </div>

            {showBookmarkCode && bookmarkletHref ? (
              <textarea
                readOnly
                value={bookmarkletHref}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-3 h-28 w-full rounded-xl border border-border bg-background p-3 font-mono text-[10px] leading-relaxed text-foreground"
              />
            ) : null}

            <div className="mt-4 rounded-xl border border-border bg-card/60 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Easier fallback: DevTools console</p>
              <p className="mt-1">
                On pokemoncenter.com press <kbd className="rounded bg-secondary px-1">F12</kbd> →
                Console → paste the console snippet → Enter. Same monitor, no bookmark needed.
              </p>
              <button
                type="button"
                onClick={() => void copyConsoleSnippet()}
                disabled={!consoleSnippet}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
              >
                {copiedConsole ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copiedConsole ? "Copied console snippet" : "Copy console snippet"}
              </button>
            </div>

            {tokenError && (
              <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {tokenError}
              </p>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              Tab monitor:{" "}
              <span className={tabConnected ? "font-medium text-trade" : "font-medium text-amber-600"}>
                {tabConnected ? "connected" : bookmarkletActive ? "stale" : "not connected yet"}
              </span>
              {status?.bookmarklet?.reportedAt &&
                ` · last ping ${new Date(status.bookmarklet.reportedAt).toLocaleTimeString()}`}
            </p>
            {!tabConnected && (
              <p className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                Pokemon Center console noise like &quot;event successful&quot; is <strong>not</strong>{" "}
                CollecTools. Look for an orange/dark badge saying <strong>PC Queue Watch</strong>. If
                it says <strong>click to sync</strong>, click it once and allow the CollecTools
                pop-up. Also run{" "}
                <code className="rounded bg-secondary px-1">supabase/queue-watch.sql</code> if you
                haven&apos;t — reports need that table across servers.
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Prefer an app?{" "}
              <Link href="/queue-watch/mobile" className="text-primary hover:underline">
                Android setup guide
              </Link>
            </p>
          </section>

          <PushAlertsOptIn className="mt-6" defaultQueueLive defaultWalmartWednesday />

          <section className="mt-6 rounded-2xl border border-border bg-card/40 p-5">
            <h2 className="text-base font-semibold text-foreground">Desktop tab alerts</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The &quot;Desktop notifications&quot; button above only alerts while this page is open.
              Phone alerts work in the background after you enable them once.
            </p>
          </section>

          <section className="mt-6 rounded-2xl border border-border bg-card/60 p-5">
            <h2 className="text-base font-semibold text-foreground">Want a phone app?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The Android app opens Pokemon Center in a WebView so you can pass Imperva, then watches
              Queue-it from that session — same approach as this bookmarklet, with native push. Keep the
              Queue tab open during drops.
            </p>
            <Link
              href="/queue-watch/mobile"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Android setup guide
            </Link>
          </section>
        </>
      ) : null}

      <SiteFooter className="mt-auto pt-10" />
    </div>
  )
}
