"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createClient, isSupabaseConfigured } from "@/lib/trade-binder/supabase/client"

type AuthContextValue = {
  user: User | null
  isLoading: boolean
  isConfigured: boolean
  authModalOpen: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
  getSupabase: () => SupabaseClient
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  runWithAuth: (action: () => void | Promise<void>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabaseRef = useRef<SupabaseClient | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void | Promise<void>) | null>(null)
  const isConfigured = isSupabaseConfigured()

  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    return supabaseRef.current
  }, [])

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false)
      return
    }

    const supabase = getSupabase()

    supabase.auth
      .getUser()
      .then(({ data }) => {
        setUser(data.user)
        setIsLoading(false)
      })
      .catch(() => {
        setUser(null)
        setIsLoading(false)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    const unlock = window.setTimeout(() => setIsLoading(false), 8_000)

    return () => {
      window.clearTimeout(unlock)
      listener.subscription.unsubscribe()
    }
  }, [getSupabase, isConfigured])

  const runPendingAction = useCallback(async (action: (() => void | Promise<void>) | null) => {
    if (!action) return
    await action()
    setPendingAction(null)
  }, [])

  useEffect(() => {
    if (user && pendingAction) {
      void runPendingAction(pendingAction)
      setAuthModalOpen(false)
    }
  }, [user, pendingAction, runPendingAction])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isConfigured,
      authModalOpen,
      openAuthModal: () => setAuthModalOpen(true),
      closeAuthModal: () => {
        setAuthModalOpen(false)
        setPendingAction(null)
      },
      getSupabase,
      signIn: async (email, password) => {
        if (!isConfigured) return { error: "Supabase is not configured." }
        const { error } = await getSupabase().auth.signInWithPassword({ email, password })
        if (!error) {
          void fetch("/api/profile").catch(() => {})
        }
        return { error: error?.message ?? null }
      },
      signUp: async (email, password) => {
        if (!isConfigured) return { error: "Supabase is not configured." }
        const { error } = await getSupabase().auth.signUp({ email, password })
        if (!error) {
          void fetch("/api/profile").catch(() => {})
        }
        return { error: error?.message ?? null }
      },
      requestPasswordReset: async (email) => {
        if (!isConfigured) return { error: "Supabase is not configured." }
        const origin =
          typeof window !== "undefined" ? window.location.origin : "https://www.collectools.app"
        const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${origin}/reset-password`,
        })
        return { error: error?.message ?? null }
      },
      updatePassword: async (password) => {
        if (!isConfigured) return { error: "Supabase is not configured." }
        const { error } = await getSupabase().auth.updateUser({ password })
        return { error: error?.message ?? null }
      },
      signOut: async () => {
        if (!isConfigured) return
        await getSupabase().auth.signOut()
      },
      runWithAuth: (action) => {
        if (!isConfigured) return
        if (user) {
          void action()
          return
        }
        setPendingAction(() => action)
        setAuthModalOpen(true)
      },
    }),
    [user, isLoading, isConfigured, authModalOpen, getSupabase],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
