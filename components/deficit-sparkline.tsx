"use client"

import { useId } from "react"
import { cn } from "@/lib/utils"

interface DeficitSparklineProps {
  data: number[]
  trend: "widening" | "closing" | "stable" | "building"
  className?: string
  width?: number
  height?: number
}

/**
 * Lightweight sparkline for the raw→slab deficit over time.
 * Series values are raw − slab (positive = arbitrage gap). A rising line
 * means the gap is widening (better crack window).
 */
export function DeficitSparkline({
  data,
  trend,
  className,
  width = 120,
  height = 36,
}: DeficitSparklineProps) {
  const gradientId = useId()
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    // Larger positive gap sits higher on the chart.
    const norm = (v - min) / range
    const y = height - pad - norm * (height - pad * 2)
    return [x, y] as const
  })

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`

  const stroke =
    trend === "widening"
      ? "var(--primary)"
      : trend === "closing"
        ? "var(--destructive)"
        : "var(--muted-foreground)"

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={`Deficit trend is ${trend}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={2.5}
        fill={stroke}
      />
    </svg>
  )
}
