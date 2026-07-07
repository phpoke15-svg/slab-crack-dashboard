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

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[10px] border-2 border-border bg-card shadow-[4px_4px_0_0_var(--border)]">
        <div className="hazard-stripes h-1.5 w-full opacity-80" aria-hidden="true" />

        <div className="flex items-center justify-between border-b-2 border-border px-4 py-3">
          <h2 className="font-serif text-lg font-bold uppercase tracking-widest text-card-foreground">
            {mode === "sign-in" ? "Sign In" : "Create Account"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-xs border-2 border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex border-b-2 border-border" role="tablist">
          {(["sign-in", "sign-up"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mode === tab}
              onClick={() => switchMode(tab)}
              className={cn(
                "flex-1 px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors",
                tab === "sign-up" && "border-l-2 border-border",
                mode === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {tab === "sign-in" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xs border-2 border-border bg-input px-3 font-mono text-sm text-foreground focus-visible:border-primary focus-visible:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Password
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xs border-2 border-border bg-input px-3 font-mono text-sm text-foreground focus-visible:border-primary focus-visible:outline-none"
            />
          </label>

          {error && (
            <p className="rounded-xs border border-destructive/50 bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xs border-2 border-primary/70 bg-primary font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {mode === "sign-in" ? "Sign In" : "Create Account"}
          </button>

          {mode === "sign-up" && (
            <p className="text-center font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Check your email to confirm, then sign in.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
