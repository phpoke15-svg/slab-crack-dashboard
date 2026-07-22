"use client"

import { useEffect, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Loader2, Sparkles, Target, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  AiPortfolioPerformanceSummary,
  AiWeeklyPickDisplay,
} from "@/lib/ai-weekly-picks/types"

type PortfolioPayload = {
  ok: boolean
  weekStartDate: string
  picks: AiWeeklyPickDisplay[]
  performance: AiPortfolioPerformanceSummary
  error?: string
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || value <= 0) return "—"
  return value >= 100 ? `$${value.toFixed(0)}` : `$${value.toFixed(2)}`
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

function confidenceBadgeClass(score: number): string {
  if (score >= 80) return "border-primary/40 bg-primary/10 text-primary"
  if (score >= 65) return "border-amber-500/40 bg-amber-500/10 text-amber-600"
  return "border-border bg-secondary/60 text-muted-foreground"
}

export function AiPortfolioTracker() {
  const [payload, setPayload] = useState<PortfolioPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void fetch("/api/portfolio/weekly-picks")
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as PortfolioPayload | null
        if (cancelled) return
        if (!res.ok || !json?.ok) {
          setError(json?.error ?? "Could not load AI portfolio data")
          setPayload(null)
          return
        }
        setPayload(json)
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load AI portfolio data")
          setPayload(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-card/60">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !payload) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-8 text-center text-sm text-muted-foreground">
        {error ?? "Portfolio data unavailable."}
      </div>
    )
  }

  const { picks, performance, weekStartDate } = payload

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-border bg-card/60 p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">This Week&apos;s Top 5 Picks</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              AI-ranked purchase opportunities for week of {weekStartDate}
            </p>
          </div>
        </div>

        {picks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
            Weekly picks have not been generated yet. The Monday cron will populate this board automatically.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {picks.map((pick) => (
              <article
                key={pick.id}
                className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm"
              >
                <div className="flex gap-4">
                  <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary/30">
                    {pick.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pick.image_url}
                        alt={pick.card_name}
                        className="max-h-full max-w-full object-contain p-1"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{pick.card_name}</h3>
                        <p className="text-xs text-muted-foreground">{pick.set_name}</p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          confidenceBadgeClass(pick.confidence_score),
                        )}
                      >
                        {pick.confidence_score.toFixed(0)}% confidence
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {pick.grade_type.replace("_", " ")}
                        </span>
                        <p className="font-mono font-semibold tabular-nums">{formatMoney(pick.pick_price)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Target</span>
                        <p className="font-mono font-semibold tabular-nums text-primary">
                          {formatMoney(pick.price_target)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Now</span>
                        <p className="font-mono font-semibold tabular-nums">
                          {formatMoney(pick.current_price)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Return</span>
                        <p
                          className={cn(
                            "font-mono font-semibold tabular-nums",
                            (pick.return_pct ?? 0) >= 0 ? "text-primary" : "text-destructive",
                          )}
                        >
                          {formatPct(pick.return_pct)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{pick.ai_rationale}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card/60 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Historical AI Performance</h2>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background/70 p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Portfolio ROI</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
              {formatPct(performance.total_roi_pct)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/70 p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Win Rate</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
              {performance.win_rate_pct.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/70 p-4">
            <div className="flex items-center gap-1.5">
              <Target className="size-3.5 text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tracked Picks</p>
            </div>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
              {performance.pick_count}
            </p>
            <p className="text-xs text-muted-foreground">{performance.weeks_tracked} weeks in chart</p>
          </div>
        </div>

        {performance.chart.length > 0 ? (
          <div className="h-[320px] w-full rounded-xl border border-border bg-background/50 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performance.chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="week_start_date" stroke="#64748b" fontSize={11} tickMargin={8} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(value) => `${value}%`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "12px",
                    color: "#f8fafc",
                  }}
                  formatter={(value: number, name: string) => [`${Number(value).toFixed(2)}%`, name]}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="ai_cumulative_pct"
                  name="AI Portfolio"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="market_cumulative_pct"
                  name="Market Baseline"
                  stroke="#64748b"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
            Performance history will appear after the first few weekly pick cycles complete.
          </div>
        )}
      </section>
    </div>
  )
}
