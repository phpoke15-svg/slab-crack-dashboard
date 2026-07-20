"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"

type Mode = "sign-in" | "sign-up" | "forgot"

type SignInFormProps = {
  onSuccess?: () => void
  onClose?: () => void
  className?: string
  defaultMode?: Mode
}

export function SignInForm({ onSuccess, onClose, className, defaultMode = "sign-in" }: SignInFormProps) {
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setMode(defaultMode)
    setError(null)
    setInfo(null)
  }, [defaultMode])

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setIsSubmitting(true)

    if (mode === "forgot") {
      const result = await requestPasswordReset(email)
      setIsSubmitting(false)
      if (result.error) {
        setError(result.error)
        return
      }
      setInfo("If an account exists for that email, we sent a reset link. Check your inbox.")
      return
    }

    const result = mode === "sign-in" ? await signIn(email, password) : await signUp(email, password)
    setIsSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (mode === "sign-up") {
      setMode("sign-in")
      setInfo("Check your email to confirm, then sign in.")
      return
    }

    onSuccess?.()
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-xl", className)}>
      <div className="relative border-b border-border px-4 py-3 pr-12">
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
        <h2 className="text-base font-semibold text-foreground">
          {mode === "sign-in"
            ? "Sign in to CollecTools"
            : mode === "sign-up"
              ? "Create your account"
              : "Reset your password"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "forgot"
            ? "We’ll email you a link to choose a new password."
            : "One account for PokeMatch and SlabCrack."}
        </p>
      </div>

      {mode !== "forgot" ? (
        <div className="flex gap-1 border-b border-border p-1" role="tablist">
          {(["sign-in", "sign-up"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mode === tab}
              onClick={() => switchMode(tab)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                mode === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {tab === "sign-in" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-xl border border-border bg-secondary/60 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:bg-secondary"
          />
        </label>

        {mode !== "forgot" ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl border border-border bg-secondary/60 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:bg-secondary"
            />
          </label>
        ) : null}

        {mode === "sign-in" ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        ) : null}

        {error && (
          <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {info && (
          <p className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {mode === "sign-in"
            ? "Sign in"
            : mode === "sign-up"
              ? "Create account"
              : "Send reset link"}
        </button>

        {mode === "forgot" ? (
          <button
            type="button"
            onClick={() => switchMode("sign-in")}
            className="text-center text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Back to sign in
          </button>
        ) : null}

        {mode === "sign-up" && (
          <>
            <p className="text-center text-xs text-muted-foreground text-pretty">
              By creating an account, you agree to our{" "}
              <Link href="/terms" className="text-primary underline underline-offset-2">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
            <p className="text-center text-xs text-muted-foreground">
              Check your email to confirm, then sign in.
            </p>
          </>
        )}
      </form>
    </div>
  )
}
