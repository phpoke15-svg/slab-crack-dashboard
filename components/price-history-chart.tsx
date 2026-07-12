"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { PsaGradeNumber } from "@/lib/slab-data"

type HistoryPoint = {
  deficit: number
  rawPrice: number
  slabPrice: number
  snapshotDate: string
}

type HistoryResponse = {
  points?: HistoryPoint[]
  history?: number[]
  error?: string
}

function DualPriceChart({
  raw,
  slab,
  width,
  height,
}: {
  raw: number[]
  slab: number[]
  width: number
  height: number
}) {
  const rawGradId = useId()
  const slabGradId = useId()
  if (raw.length < 2 || slab.length < 2) return null

  const min = Math.min(...raw, ...slab)
  const max = Math.max(...raw, ...slab)
  const range = max - min || 1
  const padX = 4
  const padY = 6

  const toPoints = (data: number[]) =>
    data.map((v, i) => {
      const x = padX + (i / (data.length - 1)) * (width - padX * 2)
      const y = height - padY - ((v - min) / range) * (height - padY * 2)
      return [x, y] as const
    })

  const rawPts = toPoints(raw)
  const slabPts = toPoints(slab)
  const rawLine = rawPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const slabLine = slabPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const slabArea = `${padX},${height - padY} ${slabLine} ${width - padX},${height - padY}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      className="overflow-visible"
      role="img"
      aria-label="30-day raw and slab price history"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={slabGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={rawGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.12} />
          <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={slabArea} fill={`url(#${slabGradId})`} />
      <polyline
        points={rawLine}
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="4 3"
        opacity={0.9}
      />
      <polyline
        points={slabLine}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={rawPts[rawPts.length - 1]![0]}
        cy={rawPts[rawPts.length - 1]![1]}
        r={2.4}
        fill="var(--muted-foreground)"
      />
      <circle
        cx={slabPts[slabPts.length - 1]![0]}
        cy={slabPts[slabPts.length - 1]![1]}
        r={2.75}
        fill="var(--primary)"
      />
    </svg>
  )
}

type PriceHistoryChartProps = {
  /** Watchlist id used by slab_price_snapshots */
  cardId: string
  grade: PsaGradeNumber
  currentRaw?: number
  currentSlab?: number
  className?: string
  compact?: boolean
  /** Label override, e.g. SlabLab */
  title?: string
}

export function PriceHistoryChart({
  cardId,
  grade,
  currentRaw,
  currentSlab,
  className,
  compact = false,
  title,
}: PriceHistoryChartProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [points, setPoints] = useState<HistoryPoint[]>([])
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
    if (!visible || loaded || !cardId) return
    let cancelled = false
    setLoading(true)
    void fetch(
      `/api/card-deficit-history?id=${encodeURIComponent(cardId)}&grade=${grade}`,
    )
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as HistoryResponse | null
        if (cancelled) return
        const series = Array.isArray(data?.points) ? data.points : []
        setPoints(
          series.filter(
            (p) =>
              Number.isFinite(p.rawPrice) &&
              Number.isFinite(p.slabPrice) &&
              p.rawPrice > 0 &&
              p.slabPrice > 0,
          ),
        )
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) {
          setPoints([])
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
    setPoints([])
  }, [cardId, grade])

  const series = useMemo(() => {
    if (points.length > 0) return points
    if (
      typeof currentRaw === "number" &&
      typeof currentSlab === "number" &&
      currentRaw > 0 &&
      currentSlab > 0
    ) {
      return [
        {
          deficit: currentRaw - currentSlab,
          rawPrice: currentRaw,
          slabPrice: currentSlab,
          snapshotDate: new Date().toISOString().slice(0, 10),
        },
      ]
    }
    return []
  }, [points, currentRaw, currentSlab])

  const raw = series.map((p) => p.rawPrice)
  const slab = series.map((p) => p.slabPrice)
  const latestRaw = raw[raw.length - 1] ?? 0
  const latestSlab = slab[slab.length - 1] ?? 0
  const firstRaw = raw[0] ?? latestRaw
  const firstSlab = slab[0] ?? latestSlab
  const rawDelta = latestRaw - firstRaw
  const slabDelta = latestSlab - firstSlab

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
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title ?? `30-day prices · PSA ${grade}`}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 border-t border-dashed border-muted-foreground" />
            Raw
          </span>
          <span className="inline-flex items-center gap-1 text-primary">
            <span className="inline-block h-0.5 w-3 bg-primary" />
            PSA {grade}
          </span>
        </div>
      </div>

      {series.length >= 2 ? (
        <DualPriceChart raw={raw} slab={slab} width={320} height={compact ? 52 : 72} />
      ) : (
        <div
          className={cn(
            "flex items-center text-[11px] text-muted-foreground",
            compact ? "min-h-[52px]" : "min-h-[72px]",
          )}
        >
          {loading
            ? "Loading price history…"
            : series.length === 1
              ? "Building history — daily syncs will fill this chart."
              : "No price history yet for this card."}
        </div>
      )}

      {series.length >= 1 && (
        <div className={cn("mt-2 grid gap-1.5", compact ? "grid-cols-2" : "grid-cols-4")}>
          <Stat label="Raw now" value={`$${latestRaw.toFixed(0)}`} />
          <Stat label={`PSA ${grade}`} value={`$${latestSlab.toFixed(0)}`} tone="up" />
          {!compact && (
            <>
              <Stat
                label="Raw Δ"
                value={`${rawDelta >= 0 ? "+" : ""}$${rawDelta.toFixed(0)}`}
                tone={rawDelta > 1 ? "up" : rawDelta < -1 ? "down" : "flat"}
              />
              <Stat
                label="Slab Δ"
                value={`${slabDelta >= 0 ? "+" : ""}$${slabDelta.toFixed(0)}`}
                tone={slabDelta > 1 ? "up" : slabDelta < -1 ? "down" : "flat"}
              />
            </>
          )}
        </div>
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
