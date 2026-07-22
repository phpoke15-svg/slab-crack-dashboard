"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RechartsHistoryRow } from "@/lib/scrydex/history-chart"
import type { PriceHistoryType } from "@/lib/scrydex/price-history-type"
import type { TcgGame } from "@/lib/scrydex/types"
import {
  DEFAULT_PRICE_HISTORY_RANGE,
  PRICE_HISTORY_RANGE_OPTIONS,
  priceHistoryRangeFromDays,
  type PriceHistoryRangeKey,
} from "@/lib/pricing/price-history-range"

export type PriceHistoryChartRow = RechartsHistoryRow

const SERIES_STYLE: Record<string, { stroke: string; width: number }> = {
  RAW: { stroke: "#3b82f6", width: 2.5 },
  PSA_10: { stroke: "#10b981", width: 2.5 },
  PSA_9: { stroke: "#f59e0b", width: 2 },
  PSA_8: { stroke: "#a855f7", width: 2 },
  PSA_7: { stroke: "#64748b", width: 1.75 },
  BGS_10: { stroke: "#14b8a6", width: 2.5 },
  BGS_9_5: { stroke: "#06b6d4", width: 2 },
  BGS_9: { stroke: "#0ea5e9", width: 2 },
  CGC_10: { stroke: "#22c55e", width: 2.5 },
  CGC_9_5: { stroke: "#84cc16", width: 2 },
}

const DEFAULT_SERIES_STYLE = { stroke: "#94a3b8", width: 2 }

function seriesHasData(data: PriceHistoryChartRow[], key: string): boolean {
  return data.some((row) => typeof row[key] === "number" && (row[key] as number) > 0)
}

function formatSeriesName(key: string): string {
  if (key === "RAW") return "Raw Market"
  const underscore = key.indexOf("_")
  if (underscore <= 0) return key
  const company = key.slice(0, underscore)
  const grade = key.slice(underscore + 1).replace(/_/g, ".")
  return `${company} ${grade}`
}

function discoverSeriesFromData(data: PriceHistoryChartRow[]) {
  const keys = new Set<string>()
  for (const row of data) {
    for (const [key, value] of Object.entries(row)) {
      if (key !== "recorded_at" && typeof value === "number" && value > 0) {
        keys.add(key)
      }
    }
  }

  return [...keys]
    .sort((a, b) => {
      if (a === "RAW") return -1
      if (b === "RAW") return 1
      return a.localeCompare(b)
    })
    .map((key) => {
      const style = SERIES_STYLE[key] ?? DEFAULT_SERIES_STYLE
      return {
        key,
        stroke: style.stroke,
        width: style.width,
        name: formatSeriesName(key),
      }
    })
}

function rangePeriodLabel(key: PriceHistoryRangeKey): string {
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

type PriceHistoryChartProps =
  | {
      data: PriceHistoryChartRow[]
      scrydexId?: never
      game?: never
      mode?: never
      days?: never
      defaultRange?: never
      className?: string
    }
  | {
      data?: never
      scrydexId: string
      game?: TcgGame
      mode?: PriceHistoryType
      /** @deprecated Prefer defaultRange */
      days?: number
      defaultRange?: PriceHistoryRangeKey
      className?: string
    }

export function PriceHistoryChart(props: PriceHistoryChartProps) {
  if ("scrydexId" in props && props.scrydexId) {
    return <PriceHistoryChartLoader {...props} />
  }

  return <PriceHistoryChartView data={props.data ?? []} className={props.className} />
}

function PriceHistoryChartLoader({
  scrydexId,
  game = "pokemon",
  mode = "both",
  days,
  defaultRange,
  className,
}: {
  scrydexId: string
  game?: TcgGame
  mode?: PriceHistoryType
  days?: number
  defaultRange?: PriceHistoryRangeKey
  className?: string
}) {
  const initialRange =
    defaultRange ?? (days != null ? priceHistoryRangeFromDays(days) : DEFAULT_PRICE_HISTORY_RANGE)
  const [range, setRange] = useState<PriceHistoryRangeKey>(initialRange)
  const [data, setData] = useState<PriceHistoryChartRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRange(initialRange)
  }, [scrydexId, initialRange])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ game, range, type: mode })
    void fetch(`/api/cards/${encodeURIComponent(scrydexId)}/history?${params.toString()}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as PriceHistoryChartRow[] | { error?: string } | null
        if (cancelled) return
        if (!res.ok || !json || !Array.isArray(json)) {
          setError(
            json && typeof json === "object" && "error" in json && json.error
              ? String(json.error)
              : "Could not load price history",
          )
          setData([])
          return
        }
        setData(json)
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load price history")
          setData([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [scrydexId, game, range, mode])

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-sm",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Price history · {rangePeriodLabel(range)}
        </p>
        <div className="inline-flex flex-wrap justify-end gap-1 rounded-lg border border-border bg-secondary/40 p-0.5">
          {PRICE_HISTORY_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRange(opt.key)}
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

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-destructive">
          {error}
        </div>
      ) : (
        <PriceHistoryChartView data={data} embedded />
      )}
    </div>
  )
}

function PriceHistoryChartView({
  data,
  className,
  embedded = false,
}: {
  data: PriceHistoryChartRow[]
  className?: string
  embedded?: boolean
}) {
  const activeSeries = useMemo(() => discoverSeriesFromData(data), [data])

  if (!data || data.length === 0 || activeSeries.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground",
          !embedded && "rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-sm",
          className,
        )}
      >
        No historical price data available.
      </div>
    )
  }

  const showDots = data.length < 2

  return (
    <div
      className={cn(
        "h-[320px] w-full",
        !embedded && "rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-sm",
        className,
      )}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="recorded_at" stroke="#64748b" fontSize={11} tickMargin={8} />
          <YAxis
            stroke="#64748b"
            fontSize={11}
            tickFormatter={(value) => `$${value}`}
            width={56}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              borderColor: "#334155",
              borderRadius: "12px",
              color: "#f8fafc",
            }}
            formatter={(value: number, name: string) => [`$${Number(value).toFixed(2)}`, name]}
            labelFormatter={(label) => String(label)}
          />
          <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
          {activeSeries.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              stroke={series.stroke}
              strokeWidth={series.width}
              dot={showDots}
              name={series.name}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
