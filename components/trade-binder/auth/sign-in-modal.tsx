"use client"

import { useState } from "react"
import { Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "./auth-provider"

type Mode = "sign-in" | "sign-up"

export function SignInModal() {
  const { authModalOpen, closeAuthModal, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!authModalOpen) return null

  const resetForm = () => {
    setError(null)
    setEmail("")
    setPassword("")
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    setMode("sign-in")
    closeAuthModal()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = mode === "sign-in" ? await signIn(email, password) : await signUp(email, password)
    setIsSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (mode === "sign-up") {
      setError(null)
      setMode("sign-in")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close sign in"
        onClick={handleClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

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

          {error && (
            <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </button>

          {mode === "sign-up" && (
            <p className="text-center text-xs text-muted-foreground">
              Check your email to confirm, then sign in.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
