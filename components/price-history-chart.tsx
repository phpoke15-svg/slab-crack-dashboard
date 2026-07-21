"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { formatSlabLabel, type SlabGradeRef } from "@/lib/grading/types"
import {
  DEFAULT_PRICE_HISTORY_RANGE,
  PRICE_HISTORY_RANGE_OPTIONS,
  priceHistoryRangeFromDays,
  type PriceHistoryRangeKey,
} from "@/lib/pricing/price-history-range"
import type { PsaGradeNumber } from "@/lib/slab-data"
import type { PriceHistorySeriesKey } from "@/lib/pricing/types"

type SeriesPoint = { date: string; price: number; saleCount?: number }
type SeriesKey = string
type ChartViewMode = "raw" | "graded"

type HistoryApiResponse = {
  series?: Partial<Record<SeriesKey, SeriesPoint[]>>
  labels?: Record<SeriesKey, string>
  counts?: Partial<Record<SeriesKey, number>>
  highlightKey?: SeriesKey
  range?: { from: string | null; to: string | null }
  error?: string
}

type RangeKey = PriceHistoryRangeKey

const SERIES_COLORS: Record<string, string> = {
  raw: "var(--muted-foreground)",
  psa7: "#94a3b8",
  psa8: "#64748b",
  psa9: "#38bdf8",
  psa10: "var(--primary)",
}

const EXTRA_SERIES_COLORS = ["#a78bfa", "#f472b6", "#34d399", "#fb923c", "#60a5fa", "#fbbf24"]

function colorForSeriesKey(key: SeriesKey, index = 0): string {
  if (SERIES_COLORS[key]) return SERIES_COLORS[key]!
  return EXTRA_SERIES_COLORS[index % EXTRA_SERIES_COLORS.length]!
}

const GRADE_TO_SERIES: Record<PsaGradeNumber, PriceHistorySeriesKey> = {
  7: "psa7",
  8: "psa8",
  9: "psa9",
  10: "psa10",
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function formatMoney(value: number): string {
  const abs = Math.abs(value)
  return abs >= 100 ? `$${value.toFixed(0)}` : `$${value.toFixed(2)}`
}

function rangePeriodLabel(key: RangeKey): string {
  switch (key) {
    case "7":
      return "Last 7 days"
    case "30":
      return "Last 30 days"
    case "90":
      return "Last 90 days"
    case "180":
      return "Last 6 months"
    case "365":
      return "Last year"
    case "all":
      return "All time"
    default:
      return "Selected period"
  }
}

function periodStats(points: SeriesPoint[] | undefined) {
  if (!points || points.length === 0) return null
  const first = points[0]!.price
  const latest = points[points.length - 1]!.price
  if (points.length < 2) {
    return { first: latest, latest, change: 0, pct: 0 }
  }
  const change = latest - first
  const pct = first > 0 ? (change / first) * 100 : 0
  return { first, latest, change, pct }
}

function seriesDisplayLabel(
  key: SeriesKey,
  labels: Record<SeriesKey, string> | null,
  slabSelection?: SlabGradeRef,
): string {
  if (key === "raw") return labels?.raw ?? "Raw NM"
  if (slabSelection) return formatSlabLabel(slabSelection)
  return labels?.[key] ?? key
}

function alignSeriesByDate(
  seriesMap: Partial<Record<SeriesKey, SeriesPoint[]>>,
  keys: SeriesKey[],
): { dates: string[]; values: Record<SeriesKey, (number | null)[]> } {
  const dateSet = new Set<string>()
  for (const key of keys) {
    for (const point of seriesMap[key] ?? []) {
      dateSet.add(point.date)
    }
  }
  const dates = [...dateSet].sort()
  const values = Object.fromEntries(
    keys.map((key) => {
      const byDate = new Map((seriesMap[key] ?? []).map((p) => [p.date, p.price]))
      return [key, dates.map((date) => byDate.get(date) ?? null)]
    }),
  ) as Record<SeriesKey, (number | null)[]>
  return { dates, values }
}

function CollectrLineChart({
  dates,
  values,
  seriesKey,
  width,
  height,
  hoverIndex,
  onHover,
}: {
  dates: string[]
  values: (number | null)[]
  seriesKey: SeriesKey
  width: number
  height: number
  hoverIndex: number | null
  onHover: (index: number | null) => void
}) {
  const padX = 8
  const padY = 18
  const chartW = width - padX * 2
  const chartH = height - padY * 2

  const prices = values.filter((v): v is number => v != null && v > 0)
  if (dates.length < 1 || prices.length < 1) return null

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const color = colorForSeriesKey(seriesKey)

  const toY = (v: number) => padY + chartH - ((v - min) / range) * chartH
  const toX = (i: number) =>
    dates.length <= 1 ? padX + chartW / 2 : padX + (i / (dates.length - 1)) * chartW
  const baselineY = padY + chartH

  const pts = values
    .map((v, i) => (v != null && v > 0 ? ([toX(i), toY(v)] as const) : null))
    .filter((p): p is readonly [number, number] => p != null)

  if (pts.length < 1) return null

  if (pts.length === 1) {
    const [x, y] = pts[0]!
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Price history chart"
        onMouseLeave={() => onHover(null)}
      >
        <line x1={padX} y1={baselineY} x2={width - padX} y2={baselineY} stroke="var(--border)" strokeWidth={1} />
        <circle cx={x} cy={y} r={5} fill={color} stroke="var(--background)" strokeWidth={2} />
      </svg>
    )
  }

  if (pts.length < 2) return null

  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const areaPath = `${pts.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} L${pts[pts.length - 1]![0].toFixed(1)},${baselineY.toFixed(1)} L${pts[0]![0].toFixed(1)},${baselineY.toFixed(1)} Z`
  const hoverX = hoverIndex != null ? toX(hoverIndex) : null
  const hoverPrice = hoverIndex != null ? values[hoverIndex] : null
  const hoverY = hoverPrice != null && hoverPrice > 0 ? toY(hoverPrice) : null

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      className="overflow-visible"
      role="img"
      aria-label="Price history chart"
      preserveAspectRatio="none"
      onMouseLeave={() => onHover(null)}
    >
      <defs>
        <linearGradient id={`price-fill-${seriesKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <path d={areaPath} fill={`url(#price-fill-${seriesKey})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {hoverX != null && hoverY != null ? (
        <>
          <line
            x1={hoverX}
            x2={hoverX}
            y1={padY}
            y2={baselineY}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <circle cx={hoverX} cy={hoverY} r={3.5} fill={color} stroke="var(--background)" strokeWidth={1.5} />
        </>
      ) : null}

      {dates.map((_, i) => (
        <rect
          key={`hit-${i}`}
          x={toX(i) - chartW / dates.length / 2}
          y={padY}
          width={chartW / dates.length}
          height={chartH}
          fill="transparent"
          className="cursor-crosshair"
          onMouseEnter={() => onHover(i)}
        />
      ))}

      <text x={padX} y={height - 4} className="fill-muted-foreground text-[9px]">
        {formatShortDate(dates[0]!)}
      </text>
      <text x={padX + chartW} y={height - 4} textAnchor="end" className="fill-muted-foreground text-[9px]">
        {formatShortDate(dates[dates.length - 1]!)}
      </text>
    </svg>
  )
}

type PriceHistoryChartProps = {
  cardId: string
  grade?: PsaGradeNumber
  slabSelection?: SlabGradeRef
  currentRaw?: number
  currentSlab?: number
  className?: string
  compact?: boolean
  title?: string
  subtitle?: string
  days?: number
  historyEndpoint?: string
  historyQuery?: Record<string, string | undefined>
  rawOnly?: boolean
}

export function PriceHistoryChart({
  cardId,
  grade,
  slabSelection,
  currentRaw,
  currentSlab,
  className,
  compact = false,
  title,
  subtitle,
  days: initialDays = 30,
  historyEndpoint = "/api/card-price-history",
  historyQuery,
  rawOnly = false,
}: PriceHistoryChartProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [range, setRange] = useState<RangeKey>(priceHistoryRangeFromDays(initialDays) ?? DEFAULT_PRICE_HISTORY_RANGE)
  const [viewMode, setViewMode] = useState<ChartViewMode>("graded")
  const [seriesMap, setSeriesMap] = useState<Partial<Record<SeriesKey, SeriesPoint[]>>>({})
  const [labels, setLabels] = useState<Record<SeriesKey, string> | null>(null)
  const [highlightKey, setHighlightKey] = useState<SeriesKey>(
    rawOnly ? "raw" : GRADE_TO_SERIES[grade ?? 10],
  )
  const [loading, setLoading] = useState(false)
  const [loadedKey, setLoadedKey] = useState("")
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    if (rawOnly) {
      setViewMode("raw")
      setHighlightKey("raw")
      return
    }
    if (slabSelection) {
      setHighlightKey(`slab:${slabSelection.company}|${slabSelection.grade}`)
      return
    }
    if (grade != null) {
      setHighlightKey(GRADE_TO_SERIES[grade])
    }
  }, [grade, slabSelection, rawOnly])

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

  const fetchKey = `${historyEndpoint}|${cardId}|${range}|${JSON.stringify(historyQuery ?? {})}|${JSON.stringify(slabSelection ?? {})}`

  useEffect(() => {
    if (!visible || loadedKey === fetchKey || !cardId) return
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ id: cardId, range })
    for (const [key, value] of Object.entries(historyQuery ?? {})) {
      if (value) params.set(key, value)
    }
    void fetch(`${historyEndpoint}?${params.toString()}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as HistoryApiResponse | null
        if (cancelled) return
        setSeriesMap(data?.series ?? {})
        setLabels(data?.labels ?? null)
        if (data?.highlightKey && !rawOnly) setHighlightKey(data.highlightKey)
        setLoadedKey(fetchKey)
      })
      .catch(() => {
        if (!cancelled) {
          setSeriesMap({})
          setLoadedKey(fetchKey)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [visible, loadedKey, fetchKey, cardId, range, historyEndpoint, historyQuery, rawOnly])

  useEffect(() => {
    setLoadedKey("")
    setSeriesMap({})
    setHoverIndex(null)
  }, [cardId, slabSelection?.company, slabSelection?.grade])

  const activeSeriesKey = viewMode === "raw" || rawOnly ? "raw" : highlightKey
  const activeSeries = seriesMap[activeSeriesKey]
  const hasChart = (activeSeries?.length ?? 0) >= 1

  const { dates, values } = useMemo(
    () => alignSeriesByDate(seriesMap, hasChart ? [activeSeriesKey] : []),
    [seriesMap, activeSeriesKey, hasChart],
  )

  const stats = periodStats(activeSeries)
  const hoverDate = hoverIndex != null ? dates[hoverIndex] : null
  const hoverPoint =
    hoverDate != null ? activeSeries?.find((point) => point.date === hoverDate) ?? null : null

  const displayPrice =
    hoverPoint?.price ??
    stats?.latest ??
    (viewMode === "raw" || rawOnly ? currentRaw : currentSlab) ??
    0

  const displayLabel = seriesDisplayLabel(activeSeriesKey, labels, slabSelection)
  const periodLabel = rangePeriodLabel(range)

  return (
    <div
      ref={rootRef}
      className={cn(
        "rounded-2xl border border-border bg-card/60",
        compact ? "p-3" : "p-4",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {!rawOnly ? (
          <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-0.5">
            {(["raw", "graded"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setViewMode(mode)
                  setHoverIndex(null)
                }}
                className={cn(
                  "rounded-md px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
                  viewMode === mode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title ?? "Price history"}
          </span>
        )}

        <div className="inline-flex flex-wrap justify-end gap-1 rounded-lg border border-border bg-secondary/40 p-0.5">
          {PRICE_HISTORY_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setRange(opt.key)
                setLoadedKey("")
                setHoverIndex(null)
              }}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-semibold transition-colors",
                range === opt.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground">
              {displayPrice > 0 ? formatMoney(displayPrice) : "—"}
            </p>
            {stats && stats.change !== 0 ? (
              <p
                className={cn(
                  "mt-0.5 font-mono text-sm font-semibold tabular-nums",
                  stats.change > 0 ? "text-primary" : "text-destructive",
                )}
              >
                {stats.change > 0 ? "+" : stats.change < 0 ? "−" : ""}
                {formatMoney(Math.abs(stats.change))} ({stats.pct > 0 ? "+" : ""}
                {stats.pct.toFixed(1)}%)
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">No change in this period</p>
            )}
          </div>
          {hoverPoint ? (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Selected date</p>
              <p className="font-medium text-foreground">{formatShortDate(hoverPoint.date)}</p>
            </div>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {displayLabel} · {periodLabel}
          {subtitle ? ` · ${subtitle}` : ""}
        </p>
      </div>

      {hasChart ? (
        <CollectrLineChart
          dates={dates}
          values={values[activeSeriesKey] ?? []}
          seriesKey={activeSeriesKey}
          width={360}
          height={compact ? 132 : 168}
          hoverIndex={hoverIndex}
          onHover={setHoverIndex}
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl border border-dashed border-border/80 bg-secondary/20 px-4 text-center text-sm text-muted-foreground",
            compact ? "min-h-[132px]" : "min-h-[168px]",
          )}
        >
          {loading
            ? "Loading price history…"
            : viewMode === "raw" || rawOnly
              ? currentRaw && currentRaw > 0
                ? "Raw price history is still building — check back after the next sync."
                : "No raw price history yet for this card."
              : currentSlab && currentSlab > 0
                ? "Graded price history is still building — try Raw or another grade."
                : "No graded price history yet for this selection."}
        </div>
      )}
    </div>
  )
}
