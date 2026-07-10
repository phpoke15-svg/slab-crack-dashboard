"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import type { SetupHealthResult } from "@/lib/trade-binder/setup-health"
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/config"
import { cn } from "@/lib/utils"

const BILLING_CHECK_IDS = new Set(["profiles_plan", "subscriptions"])

export function PokeMatchSetupBanner() {
  const [health, setHealth] = useState<SetupHealthResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const showOperatorHints = process.env.NODE_ENV === "development"

  useEffect(() => {
    void fetch("/api/pokematch/setup-health", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SetupHealthResult | null) => {
        setHealth(data)
        setFetchFailed(!data)
      })
      .catch(() => {
        setHealth(null)
        setFetchFailed(true)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (fetchFailed) {
    return (
      <div
        role="status"
        className="mb-4 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground"
      >
        Couldn&apos;t verify PokeMatch status. Refresh to try again.
      </div>
    )
  }
  if (!health || health.ready) return null

  const productFailed = health.checks.filter(
    (c) => !c.ok && !BILLING_CHECK_IDS.has(c.id),
  )
  // Billing-only gaps shouldn't scare collectors with a setup banner.
  if (productFailed.length === 0) return null

  const failed = health.checks.filter((c) => !c.ok)

  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">PokeMatch is temporarily limited</p>
          <p className="mt-1 text-xs text-muted-foreground text-pretty">
            Matching or trades may not work right now. Try again shortly, or contact{" "}
            <a
              href={`mailto:${LEGAL_CONTACT_EMAIL}`}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </p>
          {showOperatorHints ? (
            <p className="mt-2 text-xs text-muted-foreground text-pretty">
              Operator: run{" "}
              <code className="rounded bg-background/80 px-1 py-0.5">{health.setupSql}</code> in
              Supabase SQL Editor, wait ~30s, then refresh.
            </p>
          ) : null}
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300"
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {failed.length} missing piece{failed.length === 1 ? "" : "s"}
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1 text-xs" aria-live="polite">
              {health.checks.map((check) => (
                <li
                  key={check.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg px-2 py-1",
                    check.ok ? "text-muted-foreground" : "bg-background/60 text-foreground",
                  )}
                >
                  {check.ok ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-trade" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  )}
                  <span>
                    <span className="font-medium">{check.label}</span>
                    {showOperatorHints && !check.ok && check.detail ? (
                      <span className="block text-muted-foreground">{check.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
