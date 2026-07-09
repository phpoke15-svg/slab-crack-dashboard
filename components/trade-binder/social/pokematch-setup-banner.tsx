"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import type { SetupHealthResult } from "@/lib/trade-binder/setup-health"
import { cn } from "@/lib/utils"

export function PokeMatchSetupBanner() {
  const [health, setHealth] = useState<SetupHealthResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    void fetch("/api/pokematch/setup-health", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SetupHealthResult | null) => setHealth(data))
      .catch(() => setHealth(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (!health || health.ready) return null

  const failed = health.checks.filter((c) => !c.ok)

  return (
    <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">PokeMatch database setup incomplete</p>
          <p className="mt-1 text-xs text-muted-foreground text-pretty">
            Run <code className="rounded bg-background/80 px-1 py-0.5">{health.setupSql}</code>{" "}
            (or <code className="rounded bg-background/80 px-1 py-0.5">supabase/pokematch-missing-pieces.sql</code>{" "}
            if only card numbers / price cache are missing) in your Supabase SQL Editor, then wait
            ~30 seconds and refresh.
          </p>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300"
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {failed.length} missing piece{failed.length === 1 ? "" : "s"}
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1 text-xs">
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
                    {!check.ok && check.detail ? (
                      <span className="block text-muted-foreground">{check.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      </div>
    </div>
  )
}
