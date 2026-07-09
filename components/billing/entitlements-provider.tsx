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
  refresh: () => Promise<void>
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

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/billing/entitlements", { credentials: "same-origin" })
      const data = (await res.json().catch(() => null)) as
        | (Entitlements & { signedIn?: boolean; stripeConfigured?: boolean })
        | null
      if (!data || !res.ok) {
        setEntitlements(defaultState)
        setSignedIn(Boolean(user))
        return
      }
      setEntitlements({
        plan: (data.plan as PlanId) || "free",
        adFree: Boolean(data.adFree),
        queueWatch: Boolean(data.queueWatch),
        status: data.status ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
      })
      setSignedIn(Boolean(data.signedIn))
      setStripeConfigured(Boolean(data.stripeConfigured))
    } catch {
      setEntitlements(defaultState)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, user?.id, refresh])

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
