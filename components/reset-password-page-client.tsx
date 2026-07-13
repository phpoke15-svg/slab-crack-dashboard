"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteFooter } from "@/components/legal/site-footer"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getSupabase, isConfigured, updatePassword, isLoading } = useAuth()
  const [ready, setReady] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isConfigured) {
      setBootError("Auth is not configured.")
      return
    }

    let cancelled = false
    const supabase = getSupabase()

    const markReady = () => {
      if (!cancelled) setReady(true)
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        markReady()
      }
    })

    void (async () => {
      const code = searchParams.get("code")
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (exchangeError) {
          setBootError(exchangeError.message || "Reset link is invalid or expired.")
          return
        }
        markReady()
        router.replace("/reset-password")
        return
      }

      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) {
        markReady()
        return
      }

      // Give hash/token parsing a moment (implicit flow).
      window.setTimeout(async () => {
        if (cancelled) return
        const again = await supabase.auth.getSession()
        if (again.data.session) {
          markReady()
          return
        }
        setBootError("Open the reset link from your email to continue.")
      }, 800)
    })()

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [getSupabase, isConfigured, router, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)
    const result = await updatePassword(password)
    setIsSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    router.replace("/sign-in")
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <CollecToolsBrand href="/" size="sm" subtitle="Collector account" />
        <Link href="/sign-in" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Sign in
        </Link>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Choose a new password</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            After saving, you can sign in with your new password.
          </p>
        </div>

        {isLoading || (!ready && !bootError) ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Verifying reset link…
          </div>
        ) : bootError ? (
          <div className="flex flex-col gap-3 p-4">
            <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {bootError}
            </p>
            <Link
              href="/sign-in"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">New password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl border border-border bg-secondary/60 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:bg-secondary"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Confirm password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11 rounded-xl border border-border bg-secondary/60 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:bg-secondary"
              />
            </label>

            {error ? (
              <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Save new password
            </button>
          </form>
        )}
      </div>

      <SiteFooter className="mt-8" />
    </div>
  )
}

export function ResetPasswordPageClient() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
