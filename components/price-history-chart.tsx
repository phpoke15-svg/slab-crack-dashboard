"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { PsaGradeNumber } from "@/lib/slab-data"

type HistoryPoint = {
  deficit: number
  rawPrice: number
  slabPrice: number
  snapshotDate: string
  rawSaleCount?: number
  slabSaleCount?: number
  fromSales?: boolean
}

type HistoryResponse = {
  points?: HistoryPoint[]
  history?: number[]
  days?: number
  salesDays?: number
  hasSalesHistory?: boolean
  live?: boolean
  error?: string
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function DualPriceChart({
  points,
  width,
  height,
  grade,
  onHover,
}: {
  points: HistoryPoint[]
  width: number
  height: number
  grade: PsaGradeNumber
  onHover: (index: number | null) => void
}) {
  const rawGradId = useId()
  const slabGradId = useId()
  const raw = points.map((p) => p.rawPrice)
  const slab = points.map((p) => p.slabPrice)
  if (raw.length < 2 || slab.length < 2) return null

  const min = Math.min(...raw, ...slab)
  const max = Math.max(...raw, ...slab)
  const range = max - min || 1
  const padX = 28
  const padY = 14
  const chartW = width - padX * 2
  const chartH = height - padY * 2

  const toPoints = (data: number[]) =>
    data.map((v, i) => {
      const x = padX + (i / (data.length - 1)) * chartW
      const y = padY + chartH - ((v - min) / range) * chartH
      return [x, y] as const
    })

  const rawPts = toPoints(raw)
  const slabPts = toPoints(slab)
  const rawLine = rawPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const slabLine = slabPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const slabArea = `${padX},${padY + chartH} ${slabLine} ${padX + chartW},${padY + chartH}`

  const yTicks = [min, min + range / 2, max]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      className="overflow-visible"
      role="img"
      aria-label={`Daily raw and PSA ${grade} price history`}
      preserveAspectRatio="none"
      onMouseLeave={() => onHover(null)}
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

      {yTicks.map((tick) => {
        const y = padY + chartH - ((tick - min) / range) * chartH
        return (
          <g key={tick}>
            <line
              x1={padX}
              x2={padX + chartW}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeOpacity={0.5}
              strokeWidth={0.75}
            />
            <text
              x={padX - 4}
              y={y + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[8px]"
            >
              ${Math.round(tick)}
            </text>
          </g>
        )
      })}

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

      {rawPts.map(([x, y], i) => (
        <circle
          key={`hit-${i}`}
          cx={x}
          cy={y}
          r={10}
          fill="transparent"
          className="cursor-crosshair"
          onMouseEnter={() => onHover(i)}
        />
      ))}

      <text x={padX} y={height - 2} className="fill-muted-foreground text-[8px]">
        {formatShortDate(points[0]!.snapshotDate)}
      </text>
      <text
        x={padX + chartW}
        y={height - 2}
        textAnchor="end"
        className="fill-muted-foreground text-[8px]"
      >
        {formatShortDate(points[points.length - 1]!.snapshotDate)}
      </text>
    </svg>
  )
}

type PriceHistoryChartProps = {
  /** Watchlist id used by slab_price_snapshots / slab_sale_events */
  cardId: string
  grade: PsaGradeNumber
  currentRaw?: number
  currentSlab?: number
  className?: string
  compact?: boolean
  /** Label override, e.g. SlabLab */
  title?: string
  days?: number
}

export function PriceHistoryChart({
  cardId,
  grade,
  currentRaw,
  currentSlab,
  className,
  compact = false,
  title,
  days = 30,
}: PriceHistoryChartProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [points, setPoints] = useState<HistoryPoint[]>([])
  const [salesDays, setSalesDays] = useState(0)
  const [hasSalesHistory, setHasSalesHistory] = useState(false)
  const [liveHistory, setLiveHistory] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

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
      `/api/card-deficit-history?id=${encodeURIComponent(cardId)}&grade=${grade}&days=${days}`,
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
        setSalesDays(typeof data?.salesDays === "number" ? data.salesDays : 0)
        setHasSalesHistory(Boolean(data?.hasSalesHistory))
        setLiveHistory(Boolean(data?.live))
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
  }, [visible, loaded, cardId, grade, days])

  useEffect(() => {
    setLoaded(false)
    setPoints([])
    setHoverIndex(null)
    setLiveHistory(false)
  }, [cardId, grade, days])

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
  const hoverPoint = hoverIndex != null ? series[hoverIndex] : null

  const subtitle = liveHistory
    ? `${salesDays} day${salesDays === 1 ? "" : "s"} of live eBay sold comps`
    : hasSalesHistory
      ? `${salesDays} day${salesDays === 1 ? "" : "s"} of eBay sold comps`
      : series.length >= 2
        ? "Daily sync medians"
        : "Building daily history"

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
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title ?? `${days}-day sales · PSA ${grade}`}
          </span>
          <p className="text-[9px] text-muted-foreground">{subtitle}</p>
        </div>
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

      {hoverPoint && (
        <div className="mb-1.5 rounded-lg border border-border/70 bg-card/80 px-2 py-1.5 text-[10px]">
          <p className="font-medium text-foreground">{formatShortDate(hoverPoint.snapshotDate)}</p>
          <p className="text-muted-foreground">
            Raw ${hoverPoint.rawPrice.toFixed(0)}
            {hoverPoint.rawSaleCount ? ` · ${hoverPoint.rawSaleCount} sale${hoverPoint.rawSaleCount === 1 ? "" : "s"}` : ""}
            {" · "}
            PSA {grade} ${hoverPoint.slabPrice.toFixed(0)}
            {hoverPoint.slabSaleCount ? ` · ${hoverPoint.slabSaleCount} sale${hoverPoint.slabSaleCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>
      )}

      {series.length >= 2 ? (
        <DualPriceChart
          points={series}
          width={320}
          height={compact ? 72 : 96}
          grade={grade}
          onHover={setHoverIndex}
        />
      ) : (
        <div
          className={cn(
            "flex items-center text-[11px] text-muted-foreground",
            compact ? "min-h-[72px]" : "min-h-[96px]",
          )}
        >
          {loading
            ? "Loading price history…"
            : series.length === 1
              ? "One day of comps — chart needs sales on multiple days."
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
