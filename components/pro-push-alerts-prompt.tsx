"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Loader2, Smartphone, X } from "lucide-react"
import { useEntitlements } from "@/components/billing/entitlements-provider"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import {
  enableWebPush,
  hasActivePushSubscription,
  isWebPushSupported,
} from "@/lib/push/client"
import { isSupabaseConfigured } from "@/lib/trade-binder/supabase/client"

const DISMISS_UNTIL_KEY = "collectools-push-prompt-dismissed-until"
const SESSION_SHOWN_KEY = "collectools-push-prompt-session-shown"
const REMIND_LATER_MS = 24 * 60 * 60 * 1000

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_UNTIL_KEY)
    if (!raw) return false
    return Date.now() < Number(raw)
  } catch {
    return false
  }
}

function markRemindLater() {
  try {
    localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + REMIND_LATER_MS))
  } catch {
    // ignore
  }
}

function markShownThisSession() {
  try {
    sessionStorage.setItem(SESSION_SHOWN_KEY, "1")
  } catch {
    // ignore
  }
}

function wasShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_SHOWN_KEY) === "1"
  } catch {
    return false
  }
}

export function ProPushAlertsPrompt() {
  const pathname = usePathname()
  const { user, isLoading: authLoading, getSupabase, authModalOpen } = useAuth()
  const entitlements = useEntitlements()
  const hasPro = entitlements.queueWatch

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [checking, setChecking] = useState(true)

  const skipPath =
    pathname?.startsWith("/pokewatch") ||
    pathname?.startsWith("/queue-watch") ||
    pathname?.startsWith("/sign-in")

  const evaluatePrompt = useCallback(async () => {
    if (skipPath || authModalOpen || authLoading || entitlements.isLoading || !user || !hasPro) {
      setChecking(false)
      return
    }

    setChecking(true)
    const enabled = await hasActivePushSubscription()
    setPushEnabled(enabled)
    setChecking(false)

    if (enabled) {
      setOpen(false)
      return
    }

    if (isDismissed() || wasShownThisSession()) return

    markShownThisSession()
    setOpen(true)
  }, [skipPath, authModalOpen, authLoading, entitlements.isLoading, user, hasPro])

  useEffect(() => {
    if (authLoading || !isSupabaseConfigured()) return

    const supabase = getSupabase()
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        window.setTimeout(() => {
          void (async () => {
            const enabled = await hasActivePushSubscription()
            if (enabled) {
              setPushEnabled(true)
              setOpen(false)
              setChecking(false)
              return
            }
            try {
              sessionStorage.removeItem(SESSION_SHOWN_KEY)
            } catch {
              // ignore
            }
            void evaluatePrompt()
          })()
        }, 500)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [authLoading, getSupabase, evaluatePrompt])

  useEffect(() => {
    if (authLoading || !user || authModalOpen) return
    void evaluatePrompt()
  }, [authLoading, user, authModalOpen, evaluatePrompt])

  const close = () => {
    setOpen(false)
    setError(null)
  }

  const onRemindLater = () => {
    markRemindLater()
    close()
  }

  const onEnable = async () => {
    setBusy(true)
    setError(null)
    const result = await enableWebPush({ queueLive: true, walmartWednesday: true })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPushEnabled(true)
    close()
  }

  if (checking || !open || pushEnabled) return null

  const supported = isWebPushSupported()

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onRemindLater}
        className="absolute inset-0 bg-background/85 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-labelledby="pro-push-prompt-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-primary/40 bg-card p-5 shadow-2xl sm:p-6"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onRemindLater}
          className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Bell className="size-5" />
          </span>
          <div>
            <h2 id="pro-push-prompt-title" className="text-lg font-semibold text-foreground">
              Turn on phone alerts for Pokémon Center drops
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Drops move fast — queues can open and close in minutes. With phone alerts on, you get
              an instant push when{" "}
              <strong className="font-medium text-foreground">any Pro member</strong> detects the
              queue live or Imperva&apos;s drop guard. You won&apos;t miss the window because you
              weren&apos;t watching a tab.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>
              <strong className="text-foreground">Queue LIVE</strong> — jump in before slots fill
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>
              <strong className="text-foreground">Drop guard UP</strong> — Imperva verification
              appeared; open pokemoncenter.com now
            </span>
          </li>
        </ul>

        {!supported && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            <Smartphone className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              On iPhone: Safari → Share → <strong className="text-foreground">Add to Home Screen</strong>
              , open CollecTools from the icon, then enable alerts.{" "}
              <Link href="/pokewatch" className="text-primary hover:underline">
                Full setup guide
              </Link>
            </span>
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {supported ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onEnable()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
              Enable phone alerts
            </button>
          ) : (
            <Link
              href="/pokewatch"
              onClick={close}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Open PokeWatch setup
            </Link>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onRemindLater}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-50"
          >
            Remind me tomorrow
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Manage alerts anytime on{" "}
          <Link href="/pokewatch" className="text-primary hover:underline" onClick={close}>
            PokeWatch
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
