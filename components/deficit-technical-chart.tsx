"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  analyzeDeficitHistory,
  type DeficitTrend,
  type PsaGradeNumber,
} from "@/lib/slab-data"

type HistoryResponse = {
  history: number[]
  trend?: DeficitTrend
  error?: string
}

function ChartSvg({
  data,
  sma,
  trend,
  width,
  height,
}: {
  data: number[]
  sma: number | null
  trend: DeficitTrend
  width: number
  height: number
}) {
  const gradientId = useId()
  if (data.length < 2) return null

  const min = Math.min(...data, sma ?? data[0]!)
  const max = Math.max(...data, sma ?? data[0]!)
  const range = max - min || 1
  const padX = 4
  const padY = 6

  const toPoint = (v: number, i: number, len: number) => {
    const x = padX + (i / (len - 1)) * (width - padX * 2)
    const norm = (v - min) / range
    const y = height - padY - norm * (height - padY * 2)
    return [x, y] as const
  }

  const points = data.map((v, i) => toPoint(v, i, data.length))
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const area = `${padX},${height - padY} ${line} ${width - padX},${height - padY}`

  const stroke =
    trend === "widening"
      ? "var(--primary)"
      : trend === "closing"
        ? "var(--destructive)"
        : "var(--muted-foreground)"

  const smaY =
    sma == null ? null : height - padY - ((sma - min) / range) * (height - padY * 2)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      className="overflow-visible"
      role="img"
      aria-label={`30-day deficit chart, trend ${trend}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      {smaY != null && (
        <line
          x1={padX}
          x2={width - padX}
          y1={smaY}
          y2={smaY}
          stroke="var(--muted-foreground)"
          strokeOpacity={0.45}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1]![0]}
        cy={points[points.length - 1]![1]}
        r={2.75}
        fill={stroke}
      />
    </svg>
  )
}

type DeficitTechnicalChartProps = {
  cardId: string
  grade: PsaGradeNumber
  /** Seed with today's live deficit so empty history still shows one point. */
  currentDeficit?: number
  className?: string
  compact?: boolean
}

export function DeficitTechnicalChart({
  cardId,
  grade,
  currentDeficit,
  className,
  compact = false,
}: DeficitTechnicalChartProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [history, setHistory] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true)
      },
      { rootMargin: "120px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || loaded) return
    let cancelled = false
    setLoading(true)
    void fetch(`/api/card-deficit-history?id=${encodeURIComponent(cardId)}&grade=${grade}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as HistoryResponse | null
        if (cancelled) return
        const series = Array.isArray(data?.history) ? data.history.filter((n) => Number.isFinite(n)) : []
        setHistory(series)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) {
          setHistory([])
          setLoaded(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [visible, loaded, cardId, grade])

  useEffect(() => {
    setLoaded(false)
    setHistory([])
  }, [cardId, grade])

  const series = useMemo(() => {
    if (history.length > 0) return history
    if (typeof currentDeficit === "number" && Number.isFinite(currentDeficit)) {
      return [currentDeficit]
    }
    return []
  }, [history, currentDeficit])

  const analysis = useMemo(() => analyzeDeficitHistory(series), [series])

  const trendLabel =
    analysis.trend === "widening"
      ? "Widening"
      : analysis.trend === "closing"
        ? "Closing"
        : analysis.trend === "building"
          ? "Building"
          : "Stable"

  return (
    <div
      ref={rootRef}
      className={cn(
        "rounded-xl border border-border bg-secondary/30",
        compact ? "p-2.5" : "p-3",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          30-day technical · PSA {grade}
        </span>
        <span
          className={cn(
            "text-[10px] font-semibold",
            analysis.trend === "widening"
              ? "text-primary"
              : analysis.trend === "closing"
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        >
          {loading && !loaded ? "Loading…" : trendLabel}
        </span>
      </div>

      {series.length >= 2 ? (
        <ChartSvg data={series} sma={analysis.sma} trend={analysis.trend} width={320} height={compact ? 48 : 64} />
      ) : (
        <div
          className={cn(
            "flex items-center text-[11px] text-muted-foreground",
            compact ? "min-h-[48px]" : "min-h-[64px]",
          )}
        >
          {loading ? "Loading chart…" : analysis.summary}
        </div>
      )}

      {series.length >= 2 && (
        <>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            <Stat label="Now" value={`$${analysis.latest.toFixed(0)}`} />
            <Stat
              label="Δ 30d"
              value={`${analysis.change >= 0 ? "+" : ""}$${analysis.change.toFixed(0)}`}
              tone={analysis.change > 1 ? "up" : analysis.change < -1 ? "down" : "flat"}
            />
            <Stat label="High" value={`$${analysis.high.toFixed(0)}`} />
            <Stat label="7d avg" value={analysis.sma != null ? `$${analysis.sma.toFixed(0)}` : "—"} />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{analysis.summary}</p>
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone = "flat",
}: {
  label: string
  value: string
  tone?: "up" | "down" | "flat"
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/50 px-1.5 py-1 text-center">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-mono text-[11px] font-semibold tabular-nums",
          tone === "up" ? "text-primary" : tone === "down" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  )
}
