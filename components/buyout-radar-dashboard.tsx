"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import {
  AlertTriangle,
  Radar,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { BuyoutAlert, BuyoutPriority, BuyoutRadarResponse } from "@/lib/buyout-radar/types"

const PRIORITY_META: Record<
  BuyoutPriority,
  { label: string; className: string; bar: string }
> = {
  critical: {
    label: "Critical",
    className: "border-destructive/50 bg-destructive/15 text-destructive",
    bar: "bg-destructive",
  },
  high: {
    label: "High",
    className: "border-amber-500/40 bg-amber-500/15 text-amber-200",
    bar: "bg-amber-400",
  },
  warning: {
    label: "Warning",
    className: "border-sky-500/40 bg-sky-500/15 text-sky-200",
    bar: "bg-sky-400",
  },
}

function VolumeSparkline({
  values,
  className,
}: {
  values: number[]
  className?: string
}) {
  const gradId = useId()
  const width = 160
  const height = 40
  const max = Math.max(...values, 1)

  const points = values.map((v, i) => {
    const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * width
    const y = height - (v / max) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const line = points.join(" ")
  const area = `0,${height} ${line} ${width},${height}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label="24-hour transaction volume sparkline"
      preserveAspectRatio="none"
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
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ActionBadge({ action }: { action: string }) {
  const buyish = /buy|accumulate/i.test(action)
  const sellish = /sell/i.test(action)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        buyish && "border-primary/40 bg-primary/15 text-primary",
        sellish && "border-destructive/40 bg-destructive/15 text-destructive",
        !buyish && !sellish && "border-border bg-secondary/60 text-muted-foreground",
      )}
    >
      {buyish ? <Sparkles className="size-3" aria-hidden /> : null}
      {sellish ? <TrendingUp className="size-3" aria-hidden /> : null}
      {action}
    </span>
  )
}

function AlertRow({ alert }: { alert: BuyoutAlert }) {
  const meta = PRIORITY_META[alert.priority]
  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-card p-3 sm:p-4",
        alert.priority === "critical" && "border-destructive/35",
        alert.priority === "high" && "border-amber-500/25",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-muted/40 sm:w-[4.5rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={alert.imageUrl || "/placeholder.svg"}
            alt=""
            className="size-full object-contain p-0.5"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
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
            </div>
            <ActionBadge action={alert.recommendedAction} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="24h vol" value={String(alert.currentVolume)} />
            <Metric label="Baseline / day" value={alert.baselineVolume.toFixed(1)} />
            <Metric label="Multiple" value={`${alert.volumeMultiple.toFixed(1)}×`} accent />
            <Metric
              label="Buyout %"
              value={`${alert.buyoutProbabilityPercentage.toFixed(0)}%`}
              accent
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-secondary/30 p-2.5">
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Transaction speed · 24h</span>
              <span>
                {alert.uniqueBuyers} buyer hash{alert.uniqueBuyers === 1 ? "" : "es"} · conc{" "}
                {(alert.buyerConcentrationIndex * 100).toFixed(0)}%
              </span>
            </div>
            <VolumeSparkline values={alert.hourlyVolume} />
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/60">
              <div
                className={cn("h-full rounded-full transition-all", meta.bar)}
                style={{
                  width: `${Math.min(100, alert.buyoutProbabilityPercentage)}%`,
                }}
              />
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">{alert.notes}</p>
        </div>
      </div>
    </article>
  )
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function BuyoutRadarDashboard() {
  const [data, setData] = useState<BuyoutRadarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : "Could not load buyout radar")
    } finally {
      setLoading(false)
    }
  }, [])

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
              Flags cards where 24h purchase volume exceeds 5× the 14-day daily average with low
              unique-buyer concentration — often before retail listings reprice.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <SummaryChip
            icon={<ShieldAlert className="size-3.5" />}
            label="Critical"
            value={counts.critical}
            tone="critical"
          />
          <SummaryChip
            icon={<AlertTriangle className="size-3.5" />}
            label="High"
            value={counts.high}
            tone="high"
          />
          <SummaryChip
            icon={<TrendingUp className="size-3.5" />}
            label="Warning"
            value={counts.warning}
            tone="warning"
          />
        </div>

        <p className="mt-3 text-[10px] text-muted-foreground">
          {data
            ? `Source · ${data.source} · as of ${new Date(data.asOf).toLocaleString()}`
            : "Waiting for first scan…"}
          {data?.source === "seed" ? " · demo seed until SQL tables are applied" : ""}
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
      ) : !data?.alerts.length ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
          No buyout-risk anomalies in the current window.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.alerts.map((alert) => (
            <AlertRow key={`${alert.cardId}-${alert.detectedAt}`} alert={alert} />
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
}: {
  icon: ReactNode
  label: string
  value: number
  tone: BuyoutPriority
}) {
  const meta = PRIORITY_META[tone]
  return (
    <div className={cn("rounded-xl border px-3 py-2", meta.className)}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-90">
        {icon}
        {label}
      </div>
      <p className="mt-0.5 font-mono text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
