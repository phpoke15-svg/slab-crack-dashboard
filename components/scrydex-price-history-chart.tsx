"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { PriceHistoryRechartsChart } from "@/components/price-history-recharts"
import {
  toRechartsHistoryRows,
  type ScrydexHistoryChartRow,
} from "@/lib/scrydex/history-chart"
import type { TcgGame } from "@/lib/scrydex/types"

type ScrydexPriceHistoryChartProps = {
  scrydexId: string
  game?: TcgGame
  days?: number
  className?: string
}

export function ScrydexPriceHistoryChart({
  scrydexId,
  game = "pokemon",
  days = 90,
  className,
}: ScrydexPriceHistoryChartProps) {
  const [data, setData] = useState<ScrydexHistoryChartRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      game,
      days: String(days),
    })

    void fetch(`/api/cards/${encodeURIComponent(scrydexId)}/history?${params.toString()}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | ScrydexHistoryChartRow[]
          | { error?: string }
          | null
        if (cancelled) return
        if (!res.ok || !json) {
          setError(
            json && typeof json === "object" && "error" in json && json.error
              ? String(json.error)
              : "Could not load price history",
          )
          setData([])
          return
        }
        if (Array.isArray(json)) {
          setData(json)
          return
        }
        setError("Unexpected history response")
        setData([])
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

  return (
    <div className={className}>
      <PriceHistoryRechartsChart data={toRechartsHistoryRows(data)} />
    </div>
  )
}
