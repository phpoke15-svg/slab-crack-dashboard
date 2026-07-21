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
import type { RechartsHistoryRow } from "@/lib/scrydex/history-chart"
import type { TcgGame } from "@/lib/scrydex/types"

export type PriceHistoryChartRow = RechartsHistoryRow

const SERIES = [
  { key: "RAW" as const, stroke: "#3b82f6", width: 2.5, name: "Raw Market" },
  { key: "PSA_10" as const, stroke: "#10b981", width: 2.5, name: "PSA 10 Gem Mint" },
  { key: "PSA_9" as const, stroke: "#f59e0b", width: 2, name: "PSA 9 Mint" },
] as const

function seriesHasData(data: PriceHistoryChartRow[], key: keyof PriceHistoryChartRow): boolean {
  return data.some((row) => typeof row[key] === "number" && (row[key] as number) > 0)
}

type PriceHistoryChartProps =
  | {
      data: PriceHistoryChartRow[]
      scrydexId?: never
      game?: never
      days?: never
      className?: string
    }
  | {
      data?: never
      scrydexId: string
      game?: TcgGame
      days?: number
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
  days = 90,
  className,
}: {
  scrydexId: string
  game?: TcgGame
  days?: number
  className?: string
}) {
  const [data, setData] = useState<PriceHistoryChartRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ game, days: String(days) })
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
  }, [scrydexId, game, days])

  if (loading) {
    return (
      <div
        className={`flex min-h-[360px] items-center justify-center rounded-2xl border border-border bg-secondary/20 ${className ?? ""}`}
      >
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-destructive ${className ?? ""}`}
      >
        {error}
      </div>
    )
  }

  return <PriceHistoryChartView data={data} className={className} />
}

function PriceHistoryChartView({
  data,
  className,
}: {
  data: PriceHistoryChartRow[]
  className?: string
}) {
  if (!data || data.length === 0) {
    return (
      <div
        className={`flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground ${className ?? ""}`}
      >
        No historical price data available.
      </div>
    )
  }

  const activeSeries = SERIES.filter((series) => seriesHasData(data, series.key))
  const showDots = data.length < 2

  return (
    <div
      className={`h-[360px] w-full rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-sm ${className ?? ""}`}
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
