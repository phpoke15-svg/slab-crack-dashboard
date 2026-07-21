"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { PsaGradeNumber } from "@/lib/slab-data"
import type { PriceHistorySeriesKey } from "@/lib/pricing/types"

type SeriesPoint = { date: string; price: number; saleCount?: number }

type HistoryApiResponse = {
  series?: Partial<Record<PriceHistorySeriesKey, SeriesPoint[]>>
  labels?: Record<PriceHistorySeriesKey, string>
  counts?: Partial<Record<PriceHistorySeriesKey, number>>
  range?: { from: string | null; to: string | null }
  error?: string
}

type RangeKey = "30" | "90" | "365" | "all"

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "30", label: "30D" },
  { key: "90", label: "90D" },
  { key: "365", label: "1Y" },
  { key: "all", label: "All" },
]

const SERIES_COLORS: Record<PriceHistorySeriesKey, string> = {
  raw: "var(--muted-foreground)",
  psa7: "#94a3b8",
  psa8: "#64748b",
  psa9: "#38bdf8",
  psa10: "var(--primary)",
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

function alignSeriesByDate(
  seriesMap: Partial<Record<PriceHistorySeriesKey, SeriesPoint[]>>,
  keys: PriceHistorySeriesKey[],
): { dates: string[]; values: Record<PriceHistorySeriesKey, (number | null)[]> } {
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
  ) as Record<PriceHistorySeriesKey, (number | null)[]>
  return { dates, values }
}

function MultiSeriesChart({
  dates,
  values,
  activeKeys,
  highlightKey,
  width,
  height,
  onHover,
}: {
  dates: string[]
  values: Record<PriceHistorySeriesKey, (number | null)[]>
  activeKeys: PriceHistorySeriesKey[]
  highlightKey: PriceHistorySeriesKey
  width: number
  height: number
  onHover: (index: number | null) => void
}) {
  const padX = 36
  const padY = 14
  const chartW = width - padX * 2
  const chartH = height - padY * 2

  const allPrices = activeKeys.flatMap((key) =>
    (values[key] ?? []).filter((v): v is number => v != null && v > 0),
  )
  if (dates.length < 2 || allPrices.length < 2) return null

  const min = Math.min(...allPrices)
  const max = Math.max(...allPrices)
  const range = max - min || 1

  const toY = (v: number) => padY + chartH - ((v - min) / range) * chartH
  const toX = (i: number) => padX + (i / (dates.length - 1)) * chartW

  const yTicks = [min, min + range / 2, max]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      className="overflow-visible"
      role="img"
      aria-label="Pokemon API price history"
      preserveAspectRatio="none"
      onMouseLeave={() => onHover(null)}
    >
      {yTicks.map((tick) => {
        const y = toY(tick)
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
            <text x={padX - 4} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[8px]">
              ${Math.round(tick)}
            </text>
          </g>
        )
      })}

      {activeKeys.map((key) => {
        const pts = (values[key] ?? [])
          .map((v, i) => (v != null && v > 0 ? ([toX(i), toY(v)] as const) : null))
          .filter((p): p is readonly [number, number] => p != null)
        if (pts.length < 2) return null
        const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
        const isHighlight = key === highlightKey
        const isRaw = key === "raw"
        return (
          <polyline
            key={key}
            points={line}
            fill="none"
            stroke={SERIES_COLORS[key]}
            strokeWidth={isHighlight ? 2 : 1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={isRaw ? "4 3" : undefined}
            opacity={isHighlight || isRaw ? 1 : 0.55}
          />
        )
      })}

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

      <text x={padX} y={height - 2} className="fill-muted-foreground text-[8px]">
        {formatShortDate(dates[0]!)}
      </text>
      <text x={padX + chartW} y={height - 2} textAnchor="end" className="fill-muted-foreground text-[8px]">
        {formatShortDate(dates[dates.length - 1]!)}
      </text>
    </svg>
  )
}

type PriceHistoryChartProps = {
  cardId: string
  grade: PsaGradeNumber
  currentRaw?: number
  currentSlab?: number
  className?: string
  compact?: boolean
  title?: string
  subtitle?: string
  days?: number
  /** Override default `/api/card-price-history` endpoint (TCG Research uses Scrydex). */
  historyEndpoint?: string
  historyQuery?: Record<string, string | undefined>
  /** Show only raw NM series — for PokeMatch. */
  rawOnly?: boolean
}

export function PriceHistoryChart({
  cardId,
  grade,
  currentRaw,
  currentSlab,
  className,
  compact = false,
  title,
  subtitle,
  days: initialDays = 90,
  historyEndpoint = "/api/card-price-history",
  historyQuery,
  rawOnly = false,
}: PriceHistoryChartProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [range, setRange] = useState<RangeKey>(
    initialDays >= 365 ? "365" : initialDays <= 30 ? "30" : initialDays >= 9999 ? "all" : "90",
  )
  const [seriesMap, setSeriesMap] = useState<Partial<Record<PriceHistorySeriesKey, SeriesPoint[]>>>({})
  const [labels, setLabels] = useState<Record<PriceHistorySeriesKey, string> | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadedKey, setLoadedKey] = useState("")
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [showAllGrades, setShowAllGrades] = useState(false)

  const highlightKey = GRADE_TO_SERIES[grade]

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

  const fetchKey = `${historyEndpoint}|${cardId}|${range}|${JSON.stringify(historyQuery ?? {})}`

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
  }, [visible, loadedKey, fetchKey, cardId, range, historyEndpoint, historyQuery])

  useEffect(() => {
    setLoadedKey("")
    setSeriesMap({})
    setHoverIndex(null)
  }, [cardId])

  const activeKeys = useMemo(() => {
    if (rawOnly) {
      return (seriesMap.raw?.length ?? 0) >= 2 ? (["raw"] as PriceHistorySeriesKey[]) : []
    }
    const keys: PriceHistorySeriesKey[] = ["raw", highlightKey]
    if (showAllGrades) {
      for (const k of ["psa7", "psa8", "psa9", "psa10"] as const) {
        if (k !== highlightKey) keys.push(k)
      }
    }
    return keys.filter((key) => (seriesMap[key]?.length ?? 0) >= 2)
  }, [seriesMap, highlightKey, showAllGrades, rawOnly])

  const { dates, values } = useMemo(
    () => alignSeriesByDate(seriesMap, activeKeys),
    [seriesMap, activeKeys],
  )

  const hoverDate = hoverIndex != null ? dates[hoverIndex] : null
  const hoverPoints = hoverDate
    ? activeKeys
        .map((key) => {
          const point = seriesMap[key]?.find((p) => p.date === hoverDate)
          return point ? { key, ...point } : null
        })
        .filter((p): p is { key: PriceHistorySeriesKey } & SeriesPoint => p != null)
    : []

  const latestRaw = seriesMap.raw?.[seriesMap.raw.length - 1]?.price ?? currentRaw ?? 0
  const latestSlab =
    seriesMap[highlightKey]?.[seriesMap[highlightKey]!.length - 1]?.price ?? currentSlab ?? 0
  const totalPoints = Object.values(seriesMap).reduce((sum, pts) => sum + (pts?.length ?? 0), 0)

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
            {title ?? "Price history · pokemon-api"}
          </span>
          <p className="text-[9px] text-muted-foreground">
            {subtitle ??
              `TCGPlayer raw + eBay PSA comps · ${totalPoints > 0 ? `${totalPoints} points cached` : "loading…"}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setRange(opt.key)
                setLoadedKey("")
              }}
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[9px] font-medium transition-colors",
                range === opt.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card/80 text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
        {!rawOnly
          ? (["raw", "psa7", "psa8", "psa9", "psa10"] as const).map((key) => {
              const count = seriesMap[key]?.length ?? 0
              if (count < 1) return null
              const active = activeKeys.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === "raw" || key === highlightKey) return
                    setShowAllGrades((v) => !v)
                  }}
                  className={cn(
                    "inline-flex items-center gap-1",
                    active ? "text-foreground" : "opacity-40",
                  )}
                >
                  <span
                    className="inline-block h-0.5 w-3"
                    style={{
                      backgroundColor: SERIES_COLORS[key],
                      borderTop: key === "raw" ? "1px dashed" : undefined,
                    }}
                  />
                  {labels?.[key] ?? key}
                </button>
              )
            })
          : seriesMap.raw && seriesMap.raw.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-foreground">
                <span
                  className="inline-block h-0.5 w-3 border-t border-dashed"
                  style={{ borderColor: SERIES_COLORS.raw }}
                />
                {labels?.raw ?? "Raw NM"}
              </span>
            ) : null}
        {!rawOnly && !showAllGrades && (
          <button
            type="button"
            className="text-[9px] text-primary hover:underline"
            onClick={() => setShowAllGrades(true)}
          >
            + all grades
          </button>
        )}
      </div>

      {hoverPoints.length > 0 && (
        <div className="mb-1.5 rounded-lg border border-border/70 bg-card/80 px-2 py-1.5 text-[10px]">
          <p className="font-medium text-foreground">{formatShortDate(hoverDate!)}</p>
          <div className="mt-0.5 space-y-0.5 text-muted-foreground">
            {hoverPoints.map((p) => (
              <p key={p.key}>
                {labels?.[p.key] ?? p.key}: ${p.price.toFixed(0)}
                {p.saleCount ? ` · ${p.saleCount} sales` : ""}
              </p>
            ))}
          </div>
        </div>
      )}

      {dates.length >= 2 ? (
        <MultiSeriesChart
          dates={dates}
          values={values}
          activeKeys={activeKeys}
          highlightKey={highlightKey}
          width={320}
          height={compact ? 88 : 112}
          onHover={setHoverIndex}
        />
      ) : (
        <div
          className={cn(
            "flex items-center text-[11px] text-muted-foreground",
            compact ? "min-h-[88px]" : "min-h-[112px]",
          )}
        >
          {loading
            ? "Loading price history…"
            : latestRaw > 0
              ? "Only one day of history so far — check back after the next sync."
              : "No price history yet for this card."}
        </div>
      )}

      {(latestRaw > 0 || (!rawOnly && latestSlab > 0)) && (
        <div className={cn("mt-2 grid gap-1.5", rawOnly ? "grid-cols-1" : compact ? "grid-cols-2" : "grid-cols-4")}>
          <Stat label="Raw now" value={latestRaw > 0 ? `$${latestRaw.toFixed(0)}` : "—"} />
          {!rawOnly ? (
            <Stat label={`PSA ${grade}`} value={latestSlab > 0 ? `$${latestSlab.toFixed(0)}` : "—"} tone="up" />
          ) : null}
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
