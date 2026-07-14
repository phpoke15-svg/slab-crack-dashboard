"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Info,
  Radar,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ebaySearchUrl } from "@/lib/ebay-affiliate"
import type {
  BuyoutAlert,
  BuyoutPriority,
  BuyoutRadarResponse,
  RecommendedAction,
} from "@/lib/buyout-radar/types"

const PRIORITY_META: Record<
  BuyoutPriority,
  {
    label: string
    className: string
    bar: string
    meaning: string
  }
> = {
  critical: {
    label: "Critical",
    className: "border-destructive/50 bg-destructive/15 text-destructive",
    bar: "bg-destructive",
    meaning:
      "Volume is about 10×+ normal with very high buyout confidence. Treat as an active coordinated sweep.",
  },
  high: {
    label: "High",
    className: "border-amber-500/40 bg-amber-500/15 text-amber-200",
    bar: "bg-amber-400",
    meaning:
      "Strong spike (about 7–9× normal, or very high confidence). Serious buyout pressure, not quite Critical.",
  },
  warning: {
    label: "Warning",
    className: "border-sky-500/40 bg-sky-500/15 text-sky-200",
    bar: "bg-sky-400",
    meaning:
      "Clears the 1.75× volume threshold — early elevated demand. Watch closely before it becomes High/Critical.",
  },
}

const ACTION_COPY: Record<
  RecommendedAction,
  { title: string; detail: string; tone: "buy" | "sell" | "watch" }
> = {
  "Speculative Buy": {
    title: "Speculative Buy",
    detail:
      "Buying pressure looks concentrated before a likely price move. Consider acquiring copies while listings still reflect older comps.",
    tone: "buy",
  },
  "Accumulate Quietly": {
    title: "Accumulate Quietly",
    detail:
      "Signal is strong but not extreme. Scale in carefully — avoid chasing thin asks that already jumped.",
    tone: "buy",
  },
  "Monitor / Alert": {
    title: "Monitor / Alert",
    detail:
      "Activity is unusual enough to watch. Set an alert and revisit if volume stays elevated over the next few hours.",
    tone: "watch",
  },
  "Sell Peak": {
    title: "Sell Peak",
    detail:
      "If you already hold this card, the spike may be peaking. Consider selling into the elevated demand.",
    tone: "sell",
  },
}

type MetricKey =
  | "currentVolume"
  | "baselineVolume"
  | "volumeMultiple"
  | "buyoutProbability"
  | "uniqueBuyers"
  | "concentration"
  | "avgPrice24h"
  | "avgPriceBaseline"

function money(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n)
}

function metricExplainers(alert: BuyoutAlert): Record<
  MetricKey,
  { label: string; value: string; plain: string; why: string }
> {
  const copiesVsNormal =
    alert.baselineVolume > 0
      ? Math.round(alert.volumeMultiple * 10) / 10
      : alert.currentVolume
  const deltaLabel =
    alert.priceDeltaPct === 0
      ? "about flat vs the prior average"
      : alert.priceDeltaPct > 0
        ? `${alert.priceDeltaPct.toFixed(1)}% higher than the prior average`
        : `${Math.abs(alert.priceDeltaPct).toFixed(1)}% lower than the prior average`

  return {
    currentVolume: {
      label: "Bought in last 24h",
      value: `${alert.currentVolume} copies`,
      plain: `${alert.currentVolume} copies changed hands in the last day.`,
      why: "This is the live demand signal. Sudden piles of purchases are what buyouts look like in transaction data.",
    },
    baselineVolume: {
      label: "Normal daily pace",
      value: `${alert.baselineVolume.toFixed(1)} / day`,
      plain: `On a typical day over the prior 2 weeks, about ${alert.baselineVolume.toFixed(1)} copies sold.`,
      why: "Baseline is the “quiet market” average. We compare today against this so common cards don’t false-alarm.",
    },
    volumeMultiple: {
      label: "How hot vs normal",
      value: `${alert.volumeMultiple.toFixed(1)}×`,
      plain: `Today is about ${copiesVsNormal}× the usual daily volume.`,
      why: "We flag cards when this multiple clears 1.75× the recent daily norm — so quieter spikes still surface as Warnings.",
    },
    buyoutProbability: {
      label: "Buyout likelihood",
      value: `${alert.buyoutProbabilityPercentage.toFixed(0)}%`,
      plain: `Model confidence that this is a targeted buyout is ${alert.buyoutProbabilityPercentage.toFixed(0)}%.`,
      why: "Combines volume spike + how few distinct buyers are involved. Higher % = more coordinated, less organic.",
    },
    uniqueBuyers: {
      label: "Distinct buyers",
      value: String(alert.uniqueBuyers),
      plain:
        alert.uniqueBuyers === 1
          ? "All of today’s volume traces to a single buyer fingerprint."
          : `Only ${alert.uniqueBuyers} distinct buyer fingerprints account for this volume.`,
      why: "Organic demand spreads across many shoppers. Buyouts often come from 1–2 wallets/IPs hammering inventory.",
    },
    concentration: {
      label: "Buyer concentration",
      value: `${(alert.buyerConcentrationIndex * 100).toFixed(0)}%`,
      plain: `${(alert.buyerConcentrationIndex * 100).toFixed(0)}% concentration — closer to 100% means fewer people bought more of the supply.`,
      why: "Computed as 1 − (unique buyers ÷ copies). High concentration + high volume is the classic buyout signature.",
    },
    avgPrice24h: {
      label: "Avg paid (24h)",
      value: money(alert.avgPrice24h),
      plain: `Buyers paid about ${money(alert.avgPrice24h)} per copy in the last 24 hours (${deltaLabel}).`,
      why: "Average transaction unit price during the spike. Rising paid prices often confirm the buyout is already lifting the market.",
    },
    avgPriceBaseline: {
      label: "Avg paid (normal)",
      value: money(alert.avgPriceBaseline),
      plain: `Before this spike, the typical paid price was about ${money(alert.avgPriceBaseline)} per copy.`,
      why: "Baseline unit price from the prior ~2 weeks. Compare with today’s avg to see if buyers are already paying up.",
    },
  }
}

function storyForAlert(alert: BuyoutAlert): string {
  const p = PRIORITY_META[alert.priority]
  const action = ACTION_COPY[alert.recommendedAction]
  const priceBit =
    alert.avgPrice24h > 0
      ? ` Average paid price is ${money(alert.avgPrice24h)}${
          alert.avgPriceBaseline > 0
            ? ` vs a normal ${money(alert.avgPriceBaseline)} (${
                alert.priceDeltaPct >= 0 ? "+" : ""
              }${alert.priceDeltaPct.toFixed(0)}%)`
            : ""
        }.`
      : ""
  return `${alert.cardName} is ${p.label.toLowerCase()}: about ${alert.currentVolume} copies moved in 24h versus a normal ~${alert.baselineVolume.toFixed(1)}/day (${alert.volumeMultiple.toFixed(1)}×). ${alert.uniqueBuyers === 1 ? "One buyer fingerprint" : `${alert.uniqueBuyers} buyer fingerprints`} drove most of it.${priceBit} Suggested move: ${action.title}.`
}

function ebayLinksFor(alert: BuyoutAlert) {
  const q = `${alert.cardName} ${alert.setName}`
  return {
    active: ebaySearchUrl(q, `buyout-${alert.cardId}`),
    sold: ebaySearchUrl(`${q} -PSA -CGC -BGS`, `buyout-sold-${alert.cardId}`),
    query: q,
  }
}

function VolumeSparkline({
  values,
  className,
  interactive,
}: {
  values: number[]
  className?: string
  interactive?: boolean
}) {
  const gradId = useId()
  const [hover, setHover] = useState<number | null>(null)
  const width = 240
  const height = interactive ? 64 : 40
  const max = Math.max(...values, 1)

  const points = values.map((v, i) => {
    const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * width
    const y = height - (v / max) * (height - 8) - 4
    return { x, y, v, i }
  })
  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  const area = `0,${height} ${line} ${width},${height}`
  const active = hover != null ? points[hover] : null

  return (
    <div className={cn("relative", className)}>
      {active ? (
        <div className="pointer-events-none absolute -top-1 right-0 z-10 rounded-md border border-border bg-card px-2 py-1 text-[10px] text-foreground shadow-md">
          Hour {active.i + 1}/24 · <span className="font-mono font-semibold">{active.v}</span>{" "}
          {active.v === 1 ? "copy" : "copies"}
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        className="overflow-visible"
        role="img"
        aria-label="24-hour transaction volume by hour"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gradId})`} />
        <polyline
          points={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.85}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {interactive
          ? points.map((p) => (
              <g key={p.i}>
                <rect
                  x={p.x - width / values.length / 2}
                  y={0}
                  width={width / values.length}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHover(p.i)}
                  onFocus={() => setHover(p.i)}
                  tabIndex={0}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hover === p.i ? 3.5 : p.v > 0 ? 2 : 0}
                  fill="var(--primary)"
                  className="pointer-events-none"
                />
              </g>
            ))
          : null}
      </svg>
      {interactive ? (
        <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wide text-muted-foreground">
          <span>24h ago</span>
          <span>Now</span>
        </div>
      ) : null}
    </div>
  )
}

function ActionBadge({
  action,
  expanded,
}: {
  action: RecommendedAction
  expanded?: boolean
}) {
  const copy = ACTION_COPY[action]
  return (
    <div
      className={cn(
        "rounded-xl border px-2.5 py-1.5",
        copy.tone === "buy" && "border-primary/40 bg-primary/10",
        copy.tone === "sell" && "border-destructive/40 bg-destructive/10",
        copy.tone === "watch" && "border-border bg-secondary/60",
      )}
    >
      <div
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
          copy.tone === "buy" && "text-primary",
          copy.tone === "sell" && "text-destructive",
          copy.tone === "watch" && "text-muted-foreground",
        )}
      >
        {copy.tone === "buy" ? <Sparkles className="size-3" aria-hidden /> : null}
        {copy.tone === "sell" ? <TrendingUp className="size-3" aria-hidden /> : null}
        {copy.tone === "watch" ? <Info className="size-3" aria-hidden /> : null}
        Recommended · {copy.title}
      </div>
      {expanded ? (
        <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
          {copy.detail}
        </p>
      ) : null}
    </div>
  )
}

function MetricTile({
  label,
  value,
  accent,
  selected,
  onSelect,
}: {
  label: string
  value: string
  accent?: boolean
  selected?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className={cn(
        "rounded-lg border px-2 py-1.5 text-left transition-colors",
        selected
          ? "border-primary/50 bg-primary/10 ring-1 ring-primary/40"
          : "border-border/70 bg-background/40 hover:border-primary/30 hover:bg-secondary/40",
      )}
    >
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
    </button>
  )
}

function AlertCard({
  alert,
  expanded,
  onToggle,
}: {
  alert: BuyoutAlert
  expanded: boolean
  onToggle: () => void
}) {
  const meta = PRIORITY_META[alert.priority]
  const explainers = metricExplainers(alert)
  const [metric, setMetric] = useState<MetricKey>("avgPrice24h")
  const active = explainers[metric]
  const ebay = ebayLinksFor(alert)
  const priceUp = alert.priceDeltaPct > 1
  const priceDown = alert.priceDeltaPct < -1

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card transition-shadow",
        expanded && "ring-1 ring-primary/30 shadow-lg shadow-primary/5",
        alert.priority === "critical" && "border-destructive/35",
        alert.priority === "high" && "border-amber-500/25",
      )}
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:p-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-muted/40 sm:w-[4.5rem]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={alert.imageUrl || "/placeholder.svg"}
            alt=""
            className="size-full object-contain p-0.5"
          />
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex w-full flex-wrap items-start justify-between gap-2 text-left"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate font-semibold text-foreground">{alert.cardName}</h3>
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    meta.className,
                  )}
                >
                  {meta.label}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{alert.setName}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-sm">
                <span className="font-bold text-foreground">{money(alert.avgPrice24h)}</span>
                <span className="text-[11px] text-muted-foreground">avg paid · 24h</span>
                {alert.avgPriceBaseline > 0 ? (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span
                      className={cn(
                        "text-[11px] font-semibold",
                        priceUp && "text-primary",
                        priceDown && "text-destructive",
                        !priceUp && !priceDown && "text-muted-foreground",
                      )}
                    >
                      {alert.priceDeltaPct >= 0 ? "+" : ""}
                      {alert.priceDeltaPct.toFixed(0)}% vs {money(alert.avgPriceBaseline)}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ActionBadge action={alert.recommendedAction} />
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  expanded && "rotate-180",
                )}
                aria-hidden
              />
            </div>
          </button>

          <button
            type="button"
            onClick={onToggle}
            className="w-full text-left text-[12px] leading-relaxed text-foreground/90"
          >
            {storyForAlert(alert)}
          </button>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <MetricTile
              label={explainers.avgPrice24h.label}
              value={explainers.avgPrice24h.value}
              accent
              selected={expanded && metric === "avgPrice24h"}
              onSelect={() => {
                setMetric("avgPrice24h")
                if (!expanded) onToggle()
              }}
            />
            <MetricTile
              label={explainers.avgPriceBaseline.label}
              value={explainers.avgPriceBaseline.value}
              selected={expanded && metric === "avgPriceBaseline"}
              onSelect={() => {
                setMetric("avgPriceBaseline")
                if (!expanded) onToggle()
              }}
            />
            <MetricTile
              label={explainers.currentVolume.label}
              value={String(alert.currentVolume)}
              selected={expanded && metric === "currentVolume"}
              onSelect={() => {
                setMetric("currentVolume")
                if (!expanded) onToggle()
              }}
            />
            <MetricTile
              label={explainers.baselineVolume.label}
              value={alert.baselineVolume.toFixed(1)}
              selected={expanded && metric === "baselineVolume"}
              onSelect={() => {
                setMetric("baselineVolume")
                if (!expanded) onToggle()
              }}
            />
            <MetricTile
              label={explainers.volumeMultiple.label}
              value={`${alert.volumeMultiple.toFixed(1)}×`}
              accent
              selected={expanded && metric === "volumeMultiple"}
              onSelect={() => {
                setMetric("volumeMultiple")
                if (!expanded) onToggle()
              }}
            />
            <MetricTile
              label={explainers.buyoutProbability.label}
              value={`${alert.buyoutProbabilityPercentage.toFixed(0)}%`}
              accent
              selected={expanded && metric === "buyoutProbability"}
              onSelect={() => {
                setMetric("buyoutProbability")
                if (!expanded) onToggle()
              }}
            />
          </div>

          {!expanded ? (
            <p className="text-[10px] text-muted-foreground">
              Tap to expand for eBay listings (affiliate) and a full metric breakdown
            </p>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-border bg-secondary/20 px-3 py-3 sm:px-4 sm:py-4">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              Shop this card on eBay
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Open live listings with CollecTools affiliate tracking. Search uses{" "}
              <span className="font-medium text-foreground">{ebay.query}</span>.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <a
                href={ebay.active}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <ExternalLink className="size-4" aria-hidden />
                Search eBay listings
              </a>
              <a
                href={ebay.sold}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <ExternalLink className="size-4" aria-hidden />
                Search eBay (raw NM bias)
              </a>
            </div>
            <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
              {ebay.active}
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/80 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Info className="size-3.5" aria-hidden />
              What “{active.label}” means
            </div>
            <p className="text-sm leading-relaxed text-foreground">{active.plain}</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{active.why}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMetric("uniqueBuyers")}
              className={cn(
                "flex items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                metric === "uniqueBuyers"
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-card/60 hover:border-primary/25",
              )}
            >
              <Users className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {explainers.uniqueBuyers.label}
                </p>
                <p className="font-mono text-lg font-bold tabular-nums text-foreground">
                  {explainers.uniqueBuyers.value}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {explainers.uniqueBuyers.plain}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMetric("concentration")}
              className={cn(
                "flex items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                metric === "concentration"
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-card/60 hover:border-primary/25",
              )}
            >
              <Zap className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {explainers.concentration.label}
                </p>
                <p className="font-mono text-lg font-bold tabular-nums text-foreground">
                  {explainers.concentration.value}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {explainers.concentration.plain}
                </p>
              </div>
            </button>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Purchase speed by hour
              </p>
              <p className="text-[10px] text-muted-foreground">Hover a point for that hour’s volume</p>
            </div>
            <VolumeSparkline values={alert.hourlyVolume} interactive />
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Buyout likelihood</span>
                <span className="font-mono font-semibold text-foreground">
                  {alert.buyoutProbabilityPercentage.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-border/60">
                <div
                  className={cn("h-full rounded-full transition-all", meta.bar)}
                  style={{
                    width: `${Math.min(100, alert.buyoutProbabilityPercentage)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Priority · {meta.label}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-foreground/90">{meta.meaning}</p>
            <div className="mt-3">
              <ActionBadge action={alert.recommendedAction} expanded />
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export function BuyoutRadarDashboard() {
  const [data, setData] = useState<BuyoutRadarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanNote, setScanNote] = useState<string | null>(null)
  const [filter, setFilter] = useState<BuyoutPriority | "all">("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/buyout-radar", { credentials: "same-origin" })
      const json = (await res.json().catch(() => null)) as
        | BuyoutRadarResponse
        | { ok?: false; error?: string }
        | null
      if (!res.ok || !json || !("alerts" in json)) {
        throw new Error(
          (json && "error" in json && json.error) || "Could not load buyout radar",
        )
      }
      setData(json)
      setExpandedId((prev) => {
        if (prev && json.alerts.some((a) => a.cardId === prev)) return prev
        return json.alerts[0]?.cardId ?? null
      })
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : "Could not load buyout radar")
    } finally {
      setLoading(false)
    }
  }, [])

  const runMarketScan = useCallback(async () => {
    setScanning(true)
    setError(null)
    setScanNote(null)
    try {
      const res = await fetch("/api/buyout-radar/scan", {
        method: "POST",
        credentials: "same-origin",
      })
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean
            error?: string
            alertCount?: number
            coverageNote?: string
            marketUniverseSize?: number
            cardsScanned?: number
            nextOffset?: number
          }
        | null
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Market scan failed")
      }
      if (json.coverageNote) {
        setScanNote(json.coverageNote)
      } else if (json.marketUniverseSize != null) {
        setScanNote(
          `Scanned ${json.cardsScanned ?? 0} cards · universe ${json.marketUniverseSize} · next offset ${json.nextOffset ?? 0}`,
        )
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Market scan failed")
    } finally {
      setScanning(false)
    }
  }, [load])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 60_000)
    return () => window.clearInterval(id)
  }, [load])

  const counts = useMemo(() => {
    const alerts = data?.alerts ?? []
    return {
      critical: alerts.filter((a) => a.priority === "critical").length,
      high: alerts.filter((a) => a.priority === "high").length,
      warning: alerts.filter((a) => a.priority === "warning").length,
    }
  }, [data])

  const visible = useMemo(() => {
    const alerts = data?.alerts ?? []
    if (filter === "all") return alerts
    return alerts.filter((a) => a.priority === filter)
  }, [data, filter])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <section className="rounded-2xl border border-border bg-card/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-primary">
              <Radar className="size-4" aria-hidden />
              <p className="text-[11px] font-semibold uppercase tracking-wider">
                Live Market Anomaly Alerts
              </p>
            </div>
            <h2 className="mt-1 text-lg font-bold text-foreground">Buyout & Speculation Radar</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
              {data?.scan?.mode === "live"
                ? "Live market scan of the full catalog (batched each run). Cards are ranked Critical / High / Warning from 24h sales volume vs the prior 14-day daily average (alerts from 1.75× upward)."
                : data?.scan?.cardsScanned && data.scan.cardsScanned > 0
                  ? "No live buyout spikes above threshold yet — showing demo alert patterns while daily chase-first scans build coverage."
                  : "Demo mode until the first daily market scan runs. After scan, cards are classified Critical / High / Warning from real eBay sold volume spikes across the full catalog."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              aria-expanded={showGuide}
            >
              <HelpCircle className="size-3.5" aria-hidden />
              How to read this
            </button>
            <button
              type="button"
              onClick={() => void runMarketScan()}
              disabled={loading || scanning}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/25 disabled:opacity-60"
            >
              <Radar className={cn("size-3.5", scanning && "animate-spin")} aria-hidden />
              {scanning ? "Scanning market…" : "Run market scan"}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || scanning}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden />
              Refresh
            </button>
          </div>
        </div>

        {showGuide ? (
          <div className="mt-4 space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-3 text-[12px] leading-relaxed text-foreground/90">
            <p>
              <strong className="text-foreground">1. Priority chips</strong> — tap Critical / High /
              Warning to filter the list. Tap again (or All) to clear.
            </p>
            <p>
              <strong className="text-foreground">2. Alert cards</strong> — each card opens with a
              one-sentence story. Tap the card or any metric tile to expand the full explanation.
            </p>
            <p>
              <strong className="text-foreground">3. Chart</strong> — when expanded, hover the
              sparkline to see copies bought in that hour (left = 24h ago, right = now).
            </p>
            <p>
              <strong className="text-foreground">4. Recommended action</strong> — what to consider
              doing if you trust the signal (not financial advice).
            </p>
            <p>
              <strong className="text-foreground">5. Market scan</strong> — Vercel cron runs
              daily (~09:00 UTC). Each run refreshes chase cards first, then walks more of
              the catalog via eBay sold comps (≈200 cards/run). Use{" "}
              <em>Run market scan</em> to trigger the next batch now (can take a few minutes).
            </p>
          </div>
        ) : null}

        {scanNote ? (
          <p className="mt-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs leading-relaxed text-foreground/90">
            {scanNote}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryChip
            icon={<Radar className="size-3.5" />}
            label="All alerts"
            value={data?.alertCount ?? 0}
            active={filter === "all"}
            onClick={() => setFilter("all")}
            hint="Show every flagged card"
          />
          <SummaryChip
            icon={<ShieldAlert className="size-3.5" />}
            label="Critical"
            value={counts.critical}
            tone="critical"
            active={filter === "critical"}
            onClick={() => setFilter((f) => (f === "critical" ? "all" : "critical"))}
            hint={PRIORITY_META.critical.meaning}
          />
          <SummaryChip
            icon={<AlertTriangle className="size-3.5" />}
            label="High"
            value={counts.high}
            tone="high"
            active={filter === "high"}
            onClick={() => setFilter((f) => (f === "high" ? "all" : "high"))}
            hint={PRIORITY_META.high.meaning}
          />
          <SummaryChip
            icon={<TrendingUp className="size-3.5" />}
            label="Warning"
            value={counts.warning}
            tone="warning"
            active={filter === "warning"}
            onClick={() => setFilter((f) => (f === "warning" ? "all" : "warning"))}
            hint={PRIORITY_META.warning.meaning}
          />
        </div>

        {filter !== "all" ? (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{PRIORITY_META[filter].label}</span>{" "}
            only — {PRIORITY_META[filter].meaning}
          </p>
        ) : null}

        <p className="mt-3 text-[10px] text-muted-foreground">
          {data
            ? data.scan?.marketUniverseSize && data.scan.marketUniverseSize > 0
              ? `Source · ${data.source} · covered ${data.scan.cardsScanned} of ${data.scan.marketUniverseSize} catalog · next offset ${data.scan.cursorOffset ?? 0} · ~${data.scan.batchSize ?? 200}/batch · ${data.scan.salesIngested} sales · as of ${new Date(data.asOf).toLocaleString()}`
              : `Source · ${data.source} · ${data.scan?.cardsScanned ?? 0} cards with sales data · ${data.scan?.salesIngested ?? 0} sales · as of ${new Date(data.asOf).toLocaleString()}`
            : "Waiting for first scan…"}
          {data?.source === "seed"
            ? data.scan?.cardsScanned && data.scan.cardsScanned > 0
              ? " · demo alert patterns until a live spike clears 1.75× (scans keep covering the catalog)"
              : " · demo seed until you run a market scan (requires Supabase buyout tables + EBAY_SOLD_API_KEY)"
            : data?.scan?.mode === "live"
              ? " · live sold-comp volume classification"
              : ""}
        </p>
      </section>

      {loading && !data ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
          Scanning transaction velocity…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-8 text-center text-sm text-destructive">
          {error}
        </div>
      ) : !visible.length ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
          {filter === "all" ? (
            <div className="mx-auto max-w-md space-y-2">
              <p>No buyout-risk anomalies in the current 24h window.</p>
              {data?.scan?.mode === "live" &&
              data.scan.marketUniverseSize &&
              data.scan.marketUniverseSize > 0 ? (
                <p className="text-xs leading-relaxed">
                  Covered{" "}
                  <span className="font-semibold text-foreground">
                    {data.scan.cardsScanned}
                  </span>{" "}
                  of {data.scan.marketUniverseSize} catalog cards so far (~
                  {data.scan.batchSize ?? 200}/day). Quiet markets below 1.75× baseline
                  won&apos;t flag — run another market scan or wait for the next cron
                  batch. Demo alerts stay on until a real spike clears the threshold.
                </p>
              ) : null}
            </div>
          ) : (
            `No ${PRIORITY_META[filter].label.toLowerCase()} alerts right now. Try All alerts.`
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((alert) => (
            <AlertCard
              key={`${alert.cardId}-${alert.detectedAt}`}
              alert={alert}
              expanded={expandedId === alert.cardId}
              onToggle={() =>
                setExpandedId((id) => (id === alert.cardId ? null : alert.cardId))
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryChip({
  icon,
  label,
  value,
  tone,
  active,
  onClick,
  hint,
}: {
  icon: ReactNode
  label: string
  value: number
  tone?: BuyoutPriority
  active?: boolean
  onClick: () => void
  hint: string
}) {
  const meta = tone ? PRIORITY_META[tone] : null
  return (
    <button
      type="button"
      title={hint}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-3 py-2 text-left transition-all",
        meta ? meta.className : "border-border bg-secondary/40 text-foreground",
        active && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background",
        "hover:brightness-110",
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-90">
        {icon}
        {label}
      </div>
      <p className="mt-0.5 font-mono text-xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 line-clamp-2 text-[9px] leading-snug opacity-80">{hint}</p>
    </button>
  )
}
