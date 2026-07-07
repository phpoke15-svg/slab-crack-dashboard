"use client"

import { useEffect } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import {
  centeringScoreFromBorders,
  formatCenteringRatio,
  type BorderInsets,
} from "@/lib/grade-estimate"

type CenteringHelperProps = {
  imageUrl: string
  borders: BorderInsets
  onChange: (borders: BorderInsets) => void
  onCenteringScore: (score: number) => void
}

function BorderSlider({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-foreground">
          {label}
        </label>
        <span className="font-mono text-xs text-primary tabular-nums">{value}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={8}
        max={42}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary outline-none",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:bg-primary",
        )}
      />
    </div>
  )
}

export function CenteringHelper({
  imageUrl,
  borders,
  onChange,
  onCenteringScore,
}: CenteringHelperProps) {
  const score = centeringScoreFromBorders(borders)

  useEffect(() => {
    onCenteringScore(score)
  }, [score, onCenteringScore])

  const innerStyle = {
    top: `${borders.top}%`,
    right: `${borders.right}%`,
    bottom: `${borders.bottom}%`,
    left: `${borders.left}%`,
  }

  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Centering guide</h3>
          <p className="text-xs text-muted-foreground">
            Adjust borders to match the printed card art. Lines show the art box edges.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Centering</p>
          <p className="font-mono text-xl font-bold text-primary tabular-nums">{score.toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground">{formatCenteringRatio(borders)}</p>
        </div>
      </div>

      <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-xl border border-white/10 bg-black/50">
        <Image src={imageUrl} alt="Card front for centering" fill className="object-contain" unoptimized />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute border border-primary/80" style={innerStyle} />
          <div
            className="absolute left-0 right-0 border-t border-dashed border-primary/50"
            style={{ top: `${borders.top}%` }}
          />
          <div
            className="absolute left-0 right-0 border-t border-dashed border-primary/50"
            style={{ bottom: `${borders.bottom}%` }}
          />
          <div
            className="absolute bottom-0 top-0 border-l border-dashed border-primary/50"
            style={{ left: `${borders.left}%` }}
          />
          <div
            className="absolute bottom-0 top-0 border-l border-dashed border-primary/50"
            style={{ right: `${borders.right}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <BorderSlider
          id="border-left"
          label="Left border"
          value={borders.left}
          onChange={(left) => onChange({ ...borders, left })}
        />
        <BorderSlider
          id="border-right"
          label="Right border"
          value={borders.right}
          onChange={(right) => onChange({ ...borders, right })}
        />
        <BorderSlider
          id="border-top"
          label="Top border"
          value={borders.top}
          onChange={(top) => onChange({ ...borders, top })}
        />
        <BorderSlider
          id="border-bottom"
          label="Bottom border"
          value={borders.bottom}
          onChange={(bottom) => onChange({ ...borders, bottom })}
        />
      </div>
    </div>
  )
}
