"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeftRight, Gift, Heart, UserPlus, X } from "lucide-react"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { isSupabaseConfigured } from "@/lib/trade-binder/supabase/client"

const DISMISSED_KEY = "collectools-welcome-account-dismissed"
const SHOW_DELAY_MS = 900

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1"
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1")
  } catch {
    // ignore
  }
}

const BENEFITS = [
  {
    icon: ArrowLeftRight,
    title: "PokeMatch binder & trades",
    description: "Track what you have and want, then find fair swaps with other collectors.",
  },
  {
    icon: Heart,
    title: "Save cards & watchlists",
    description: "Keep SlabCrack picks and SlabIt targets synced to your account.",
  },
  {
    icon: Gift,
    title: "Giveaway entries",
    description: "Free accounts can enter monthly giveaways — no credit card required.",
  },
] as const

export function WelcomeAccountPrompt() {
  const pathname = usePathname()
  const { user, isLoading: authLoading, authModalOpen, openAuthModal } = useAuth()
  const [open, setOpen] = useState(false)

  const skipPath =
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/reset-password") ||
    pathname?.startsWith("/auth")

  useEffect(() => {
    if (skipPath || authLoading || !isSupabaseConfigured() || user || authModalOpen || wasDismissed()) {
      setOpen(false)
      return
    }

    const timer = window.setTimeout(() => {
      if (wasDismissed() || user) return
      setOpen(true)
      markDismissed()
    }, SHOW_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [skipPath, authLoading, user, authModalOpen])

  const close = () => setOpen(false)

  const onCreateAccount = () => {
    close()
    openAuthModal({ mode: "sign-up" })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={close}
        className="absolute inset-0 bg-background/85 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-labelledby="welcome-account-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-primary/35 bg-card p-5 shadow-2xl sm:p-6"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <UserPlus className="size-5" />
          </span>
          <div>
            <h2 id="welcome-account-title" className="text-lg font-semibold text-foreground">
              Create your free CollecTools account
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              One login for PokeMatch, SlabCrack, SlabIt, giveaways, and more. Takes under a minute.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-3">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="flex gap-3 text-sm">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/50 text-primary">
                <benefit.icon className="size-4" aria-hidden="true" />
              </span>
              <span>
                <span className="font-medium text-foreground">{benefit.title}</span>
                <span className="mt-0.5 block text-muted-foreground">{benefit.description}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onCreateAccount}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <UserPlus className="size-4" aria-hidden="true" />
            Create free account
          </button>
          <button
            type="button"
            onClick={close}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground"
          >
            Maybe later
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => {
              close()
              openAuthModal({ mode: "sign-in" })
            }}
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </button>
          {" · "}
          <Link href="/terms" className="text-primary hover:underline" onClick={close}>
            Terms
          </Link>
        </p>
      </div>
    </div>
  )
}
