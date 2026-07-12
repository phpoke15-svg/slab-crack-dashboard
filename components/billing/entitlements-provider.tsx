"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { entitlementsForPlan, type Entitlements, type PlanId } from "@/lib/billing/plans"

type EntitlementsState = Entitlements & {
  signedIn: boolean
  stripeConfigured: boolean
  isLoading: boolean
  refresh: (opts?: { silent?: boolean }) => Promise<void>
  startCheckout: (priceKey: string) => Promise<string | null>
  openPortal: () => Promise<string | null>
}

const defaultState: Entitlements = entitlementsForPlan("free")

const EntitlementsContext = createContext<EntitlementsState | null>(null)

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  const [entitlements, setEntitlements] = useState<Entitlements>(defaultState)
  const [signedIn, setSignedIn] = useState(false)
  const [stripeConfigured, setStripeConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const userId = user?.id ?? null

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setIsLoading(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch("/api/billing/entitlements", {
        credentials: "same-origin",
        signal: controller.signal,
      })
      const data = (await res.json().catch(() => null)) as
        | (Entitlements & { signedIn?: boolean; stripeConfigured?: boolean })
        | null
      if (typeof data?.stripeConfigured === "boolean") {
        setStripeConfigured(data.stripeConfigured)
      }
      if (!data || !res.ok) {
        setEntitlements(defaultState)
        setSignedIn(Boolean(userId))
        return
      }
      setEntitlements({
        plan: (data.plan as PlanId) || "free",
        adFree: Boolean(data.adFree),
        queueWatch: Boolean(data.queueWatch),
        fullSlabCrack: Boolean(
          data.fullSlabCrack ??
            (data.plan === "premium" || data.plan === "pro" || data.plan === "supreme"),
        ),
        supreme: Boolean(data.supreme ?? data.plan === "supreme"),
        status: data.status ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
      })
      setSignedIn(Boolean(data.signedIn))
      setStripeConfigured(Boolean(data.stripeConfigured))
    } catch {
      setEntitlements(defaultState)
      setSignedIn(Boolean(userId))
    } finally {
      window.clearTimeout(timeout)
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (authLoading) {
      const unlock = window.setTimeout(() => {
        void refresh()
      }, 8_000)
      return () => window.clearTimeout(unlock)
    }
    void refresh()
  }, [authLoading, userId, refresh])

  // Heartbeat for Site Insights active-user counts (throttled server-side).
  useEffect(() => {
    if (!userId) return

    const ping = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      void fetch("/api/presence", { method: "POST", credentials: "same-origin" })
    }

    ping()
    const interval = window.setInterval(ping, 5 * 60 * 1000)
    const onVisible = () => {
      if (document.visibilityState === "visible") ping()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [userId])

  const startCheckout = useCallback(async (priceKey: string) => {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceKey }),
    })
    const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
    if (!res.ok || !data?.url) {
      throw new Error(data?.error || "Checkout failed")
    }
    return data.url
  }, [])

  const openPortal = useCallback(async () => {
    const res = await fetch("/api/billing/portal", {
      method: "POST",
      credentials: "same-origin",
    })
    const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
    if (!res.ok || !data?.url) {
      throw new Error(data?.error || "Could not open billing portal")
    }
    return data.url
  }, [])

  const value = useMemo<EntitlementsState>(
    () => ({
      ...entitlements,
      signedIn,
      stripeConfigured,
      isLoading: authLoading || isLoading,
      refresh,
      startCheckout,
      openPortal,
    }),
    [
      entitlements,
      signedIn,
      stripeConfigured,
      authLoading,
      isLoading,
      refresh,
      startCheckout,
      openPortal,
    ],
  )

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>
}

export function useEntitlements(): EntitlementsState {
  const ctx = useContext(EntitlementsContext)
  if (!ctx) {
    throw new Error("useEntitlements must be used within EntitlementsProvider")
  }
  return ctx
}

export function useOptionalEntitlements(): EntitlementsState | null {
  return useContext(EntitlementsContext)
}
