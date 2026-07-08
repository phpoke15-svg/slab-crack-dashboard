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
  Radio,
  ShieldAlert,
  Zap,
} from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { cn } from "@/lib/utils"

const SESSION_KEY = "pc-queue-watch-session"
const POLL_MS = 4_000

type StatusResponse = {
  live: boolean
  confidence: number
  source: string
  server: { live: boolean; blocked?: boolean; signals: Array<{ label: string }> }
  bookmarklet: { live: boolean; pageUrl?: string; reportedAt?: string } | null
  checkedAt: string
}

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `pcw-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function QueueWatchClient() {
  const [sessionId, setSessionId] = useState("")
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [monitoring, setMonitoring] = useState(true)
  const [notifications, setNotifications] = useState<NotificationPermission>("default")
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previousLive = useRef(false)

  const playAlertTone = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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
    if (typeof Notification !== "undefined") setNotifications(Notification.permission)
  }, [])

  useEffect(() => {
    if (!sessionId) return
    localStorage.setItem(SESSION_KEY, sessionId)
  }, [sessionId])

  const bookmarkletHref = useMemo(() => {
    if (!sessionId || typeof window === "undefined") return ""
    const origin = window.location.origin
    const code = `javascript:(function(){var s=document.createElement('script');s.src='${origin}/pc-queue-watch.js?sid=${encodeURIComponent(sessionId)}&t='+Date.now();document.head.appendChild(s);})();`
    return code
  }, [sessionId])

  const notifyLive = useCallback(async () => {
    if (typeof window === "undefined") return

    try {
      playAlertTone()
    } catch {
      // ignore autoplay restrictions
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
    if (!sessionId) return
    try {
      const response = await fetch(`/api/pokemon-center/status?sessionId=${encodeURIComponent(sessionId)}`, {
        cache: "no-store",
      })
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
  }, [notifyLive, sessionId])

  useEffect(() => {
    if (!monitoring || !sessionId) return
    void poll()
    const id = window.setInterval(() => void poll(), POLL_MS)
    return () => window.clearInterval(id)
  }, [monitoring, poll, sessionId])

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
    window.setTimeout(() => setCopied(false), 2000)
  }

  const openPokemonCenter = () => {
    window.open("https://www.pokemoncenter.com/", "_blank", "noopener,noreferrer")
  }

  const live = status?.live ?? false
  const bookmarkletActive = Boolean(status?.bookmarklet?.reportedAt)
  const serverBlocked = status?.server?.blocked

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">

      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <CollecToolsBrand href="/" size="lg" subtitle="Queue Watch · Pokemon Center alerts" />
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Get instant alerts when Pokemon Center&apos;s virtual queue goes live. Keep a Pokemon Center tab open
            with the monitor bookmarklet for the fastest detection.
          </p>
        </div>
        <SiteAuthButton className="shrink-0" />
      </header>

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
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Queue status</p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">
              {loading && !status ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-5 animate-spin" /> Checking…
                </span>
              ) : live ? (
                "Queue is LIVE"
              ) : (
                "No queue detected"
              )}
            </h1>
            {status && (
              <p className="mt-2 text-sm text-muted-foreground">
                Source: {status.source === "bookmarklet" ? "your Pokemon Center tab" : "server probe"}
                {status.confidence > 0 && ` · ${status.confidence}% confidence`}
              </p>
            )}
          </div>
          <span
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-xl border",
              live ? "border-trade bg-trade/20 text-trade" : "border-border bg-secondary text-muted-foreground",
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
            {monitoring ? <BellRing className="size-4 text-primary" /> : <Bell className="size-4" />}
            {monitoring ? "Monitoring active" : "Start monitoring"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Polls every {POLL_MS / 1000}s while this page is open.</p>
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

      <section className="mb-6 rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="text-base font-semibold text-foreground">1. Install the tab monitor (recommended)</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pokemon Center blocks datacenter bots, so the fastest alerts come from a tab on your home network.
        </p>

        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Copy the bookmarklet below.</li>
          <li>Create a new browser bookmark and paste it as the URL.</li>
          <li>Open <strong className="text-foreground">pokemoncenter.com</strong> and click the bookmark once.</li>
          <li>Leave that tab open during drops — it watches Queue-it traffic and page signals.</li>
        </ol>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyBookmarklet()}
            disabled={!bookmarkletHref}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy bookmarklet"}
          </button>
          <button
            type="button"
            onClick={openPokemonCenter}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium"
          >
            Open Pokemon Center <ExternalLink className="size-4" />
          </button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Tab monitor: {bookmarkletActive ? "connected" : "not connected yet"}
          {status?.bookmarklet?.reportedAt &&
            ` · last ping ${new Date(status.bookmarklet.reportedAt).toLocaleTimeString()}`}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="text-base font-semibold text-foreground">2. Optional Discord alerts</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Set <code className="rounded bg-secondary px-1 py-0.5 text-xs">POKEMON_CENTER_DISCORD_WEBHOOK</code> in
          Vercel env vars to ping a channel when your tab monitor detects the queue (5 min cooldown).
        </p>
        {serverBlocked && (
          <p className="mt-3 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            Server-side checks from Vercel are often blocked by Imperva — use the bookmarklet for reliable speed.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="text-base font-semibold text-foreground">Want a real phone app (APK)?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Queue Watch is built into the CollecTools Android app — native push, no Pokemon Center tab required.
        </p>
        <Link
          href="/queue-watch/mobile"
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Build & install the APK
        </Link>
      </section>

      <footer className="mt-auto pt-10 text-center text-[11px] text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Back to CollecTools
        </Link>
      </footer>
    </div>
  )
}
