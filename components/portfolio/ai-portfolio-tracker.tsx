"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
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
import { Loader2, Lock, Sparkles, Target, TrendingUp, ExternalLink } from "lucide-react"
import { useOptionalEntitlements } from "@/components/billing/entitlements-provider"
import { cn } from "@/lib/utils"
import {
  BUCKET_TIERS,
  TIER_BUDGETS,
  type BucketTier,
} from "@/lib/ai-weekly-picks/tiers"
import { portfolioPickEbayUrl } from "@/lib/ai-weekly-picks/ebay-search"
import type {
  AiPortfolioPerformanceSummary,
  AiWeeklyPickDisplay,
  AiWeeklyGradeType,
} from "@/lib/ai-weekly-picks/types"
import { formatSlabLabel } from "@/lib/grading/types"

type PortfolioPayload = {
  ok: boolean
  access?: "preview" | "full"
  tier: BucketTier
  weekStartDate: string
  budget: { spent: number; min: number; max: number; label: string }
  picks: AiWeeklyPickDisplay[]
  performance: AiPortfolioPerformanceSummary
  error?: string
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || value <= 0) return "—"
  return value >= 100 ? `$${value.toFixed(0)}` : `$${value.toFixed(2)}`
}

function formatSignedMoney(value: number | null | undefined): string {
  if (value == null) return "—"
  const sign = value > 0 ? "+" : value < 0 ? "−" : ""
  return `${sign}$${Math.abs(value).toFixed(2)}`
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

function pickEbayLabel(grade: AiWeeklyGradeType): string {
  if (grade === "RAW") return "raw NM"
  if (grade === "PSA_10") return formatSlabLabel({ company: "PSA", grade: "10" })
  return formatSlabLabel({ company: "PSA", grade: "9" })
}

function TierTabs({
  active,
  onChange,
}: {
  active: BucketTier
  onChange: (tier: BucketTier) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-secondary/30 p-1">
      {BUCKET_TIERS.map((tier) => (
        <button
          key={tier}
          type="button"
          onClick={() => onChange(tier)}
          className={cn(
            "rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:text-sm",
            active === tier
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {TIER_BUDGETS[tier].label}
        </button>
      ))}
    </div>
  )
}

function UpgradeBanner() {
  return (
    <div className="mb-6 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <Lock className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Upgrade for full AI Portfolio access</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Starter accounts see cumulative ROI over time per budget tier. Premium, Pro, and Supreme
            unlock weekly pick baskets, win rate, gain/loss, and market baseline comparisons.
          </p>
          <Link
            href="/pricing"
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            View plans from $4.99/mo
          </Link>
        </div>
      </div>
    </div>
  )
}

function PerformanceSection({
  performance,
  fullAccess,
  tier,
}: {
  performance: AiPortfolioPerformanceSummary
  fullAccess: boolean
  tier: BucketTier
}) {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-2">
        <TrendingUp className="size-4 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          {TIER_BUDGETS[tier].label} Performance
        </h2>
      </div>

      <div
        className={cn(
          "mb-6 grid gap-4",
          fullAccess ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-1",
        )}
      >
        <div className="rounded-xl border border-border bg-background/70 p-4">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total ROI</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
            {formatPct(performance.total_roi_pct)}
          </p>
        </div>
        {fullAccess ? (
          <>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Win Rate</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
                {performance.win_rate_pct.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Total Gain / Loss
              </p>
              <p
                className={cn(
                  "mt-1 font-mono text-2xl font-bold tabular-nums",
                  performance.total_gain_loss_usd >= 0 ? "text-primary" : "text-destructive",
                )}
              >
                {formatSignedMoney(performance.total_gain_loss_usd)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <div className="flex items-center gap-1.5">
                <Target className="size-3.5 text-muted-foreground" />
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Tracked Picks
                </p>
              </div>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
                {performance.pick_count}
              </p>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground sm:col-span-1">
            Starter preview · cumulative ROI chart for this tier
          </p>
        )}
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
                name={`${TIER_BUDGETS[tier].label} ROI`}
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
              {fullAccess ? (
                <Line
                  type="monotone"
                  dataKey="market_cumulative_pct"
                  name="Market Baseline"
                  stroke="#64748b"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
          Performance history will appear after weekly picks are generated for this tier.
        </div>
      )}
    </section>
  )
}

function PicksSection({
  picks,
  weekStartDate,
  tier,
  budget,
}: {
  picks: AiWeeklyPickDisplay[]
  weekStartDate: string
  tier: BucketTier
  budget: PortfolioPayload["budget"]
}) {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              This Week&apos;s ${tier} Picks
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Week of {weekStartDate} · budget allocation{" "}
            <span className="font-mono font-semibold text-foreground">
              {formatMoney(budget.spent)} / {formatMoney(budget.max)} spent
            </span>
          </p>
        </div>
      </div>

      {picks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
          No picks for this tier yet. Re-run the weekly cron after applying the multi-tier migration.
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
              <a
                href={portfolioPickEbayUrl({
                  scrydex_id: pick.scrydex_id,
                  card_name: pick.card_name,
                  card_number: pick.card_number,
                  set_name: pick.set_name,
                  grade_type: pick.grade_type,
                  bucket_tier: pick.bucket_tier,
                })}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <ExternalLink className="size-4" />
                Search eBay {pickEbayLabel(pick.grade_type)}
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function AiPortfolioTracker() {
  const entitlements = useOptionalEntitlements()
  const [activeTier, setActiveTier] = useState<BucketTier>("100")
  const [payload, setPayload] = useState<PortfolioPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fullAccess = Boolean(
    payload?.access === "full" || entitlements?.fullAiPortfolio,
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void fetch(`/api/portfolio/weekly-picks?tier=${activeTier}`, { credentials: "same-origin" })
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
  }, [activeTier])

  return (
    <div className="flex flex-col gap-6">
      <TierTabs active={activeTier} onChange={setActiveTier} />

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-card/60">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error || !payload ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-8 text-center text-sm text-muted-foreground">
          {error ?? "Portfolio data unavailable."}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {!fullAccess ? <UpgradeBanner /> : null}

          {fullAccess ? (
            <PicksSection
              picks={payload.picks}
              weekStartDate={payload.weekStartDate}
              tier={activeTier}
              budget={payload.budget}
            />
          ) : (
            <section className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-center">
              <Lock className="mx-auto size-5 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold text-foreground">
                Weekly pick baskets are a paid Labs feature
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Upgrade to Premium, Pro, or Supreme to unlock tiered AI pick baskets for this budget.
              </p>
              <Link
                href="/pricing"
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                View plans
              </Link>
            </section>
          )}

          <PerformanceSection
            performance={payload.performance}
            fullAccess={fullAccess}
            tier={activeTier}
          />
        </div>
      )}
    </div>
  )
}
