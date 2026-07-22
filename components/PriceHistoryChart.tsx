"use client"

import { useEffect, useState } from "react"
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
import type { TcgGame } from "@/lib/scrydex/types"
import {
  DEFAULT_PRICE_HISTORY_RANGE,
  PRICE_HISTORY_RANGE_OPTIONS,
  priceHistoryRangeFromDays,
  type PriceHistoryRangeKey,
} from "@/lib/pricing/price-history-range"

export type PriceHistoryChartRow = RechartsHistoryRow

const SERIES = [
  { key: "RAW" as const, stroke: "#3b82f6", width: 2.5, name: "Raw Market" },
  { key: "PSA_10" as const, stroke: "#10b981", width: 2.5, name: "PSA 10 Gem Mint" },
  { key: "PSA_9" as const, stroke: "#f59e0b", width: 2, name: "PSA 9 Mint" },
] as const

function seriesHasData(data: PriceHistoryChartRow[], key: keyof PriceHistoryChartRow): boolean {
  return data.some((row) => typeof row[key] === "number" && (row[key] as number) > 0)
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
      days?: never
      defaultRange?: never
      className?: string
    }
  | {
      data?: never
      scrydexId: string
      game?: TcgGame
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
  days,
  defaultRange,
  className,
}: {
  scrydexId: string
  game?: TcgGame
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

    const params = new URLSearchParams({ game, range })
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
  }, [scrydexId, game, range])

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
  if (!data || data.length === 0) {
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

  const activeSeries = SERIES.filter((series) => seriesHasData(data, series.key))
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
