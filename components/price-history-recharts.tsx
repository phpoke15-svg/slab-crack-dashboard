"use client"

import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { RechartsHistoryRow } from "@/lib/scrydex/history-chart"

const SERIES = [
  { key: "RAW" as const, stroke: "#3b82f6", width: 2.5, name: "Raw Market" },
  { key: "PSA_10" as const, stroke: "#10b981", width: 2.5, name: "PSA 10 Gem Mint" },
  { key: "PSA_9" as const, stroke: "#f59e0b", width: 2, name: "PSA 9 Mint" },
  { key: "PSA_8" as const, stroke: "#64748b", width: 1.75, name: "PSA 8" },
  { key: "PSA_7" as const, stroke: "#94a3b8", width: 1.75, name: "PSA 7" },
]

function seriesHasData(data: RechartsHistoryRow[], key: keyof RechartsHistoryRow): boolean {
  return data.some((row) => typeof row[key] === "number" && (row[key] as number) > 0)
}

export function PriceHistoryRechartsChart({ data }: { data: RechartsHistoryRow[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
        No historical price data available.
      </div>
    )
  }

  const activeSeries = SERIES.filter((series) => seriesHasData(data, series.key))

  return (
    <div className="h-[360px] w-full rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-sm">
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
              dot={false}
              name={series.name}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
