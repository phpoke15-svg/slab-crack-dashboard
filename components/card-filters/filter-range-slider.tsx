"use client"

import { useCallback, useId, useRef } from "react"
import { cn } from "@/lib/utils"

type FilterRangeSliderProps = {
  min: number
  max: number
  step?: number
  valueMin: number
  valueMax: number
  onChange: (next: { min: number; max: number }) => void
  formatValue?: (value: number) => string
  label: string
  className?: string
}

const THUMB_CLASS =
  "pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-md shadow-black/30 ring-0 transition-[box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

const TRACK_CLASS = "absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-secondary"

/**
 * Accessible dual-thumb range slider built from native range inputs.
 * Two overlapping inputs share one track; z-index swaps so the active thumb stays draggable.
 */
export function FilterRangeSlider({
  min,
  max,
  step = 1,
  valueMin,
  valueMax,
  onChange,
  formatValue = (v) => String(v),
  label,
  className,
}: FilterRangeSliderProps) {
  const baseId = useId()
  const minRef = useRef<HTMLInputElement>(null)
  const maxRef = useRef<HTMLInputElement>(null)

  const span = max - min
  const minPercent = span === 0 ? 0 : ((valueMin - min) / span) * 100
  const maxPercent = span === 0 ? 100 : ((valueMax - min) / span) * 100

  const bumpZIndex = useCallback((active: "min" | "max") => {
    if (minRef.current) minRef.current.style.zIndex = active === "min" ? "30" : "20"
    if (maxRef.current) maxRef.current.style.zIndex = active === "max" ? "30" : "20"
  }, [])

  const handleMin = (raw: number) => {
    const nextMin = Math.min(raw, valueMax)
    onChange({ min: nextMin, max: valueMax })
  }

  const handleMax = (raw: number) => {
    const nextMax = Math.max(raw, valueMin)
    onChange({ min: valueMin, max: nextMax })
  }

  const rangeInputClass = cn(
    "absolute inset-x-0 top-1/2 h-6 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent",
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10",
    "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none",
    "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary",
    "[&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-black/30",
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-grab",
    "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary",
    "[&::-moz-range-thumb]:bg-background",
    "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent",
    "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-transparent",
  )

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="font-mono text-sm font-semibold text-primary tabular-nums">
          {formatValue(valueMin)} – {formatValue(valueMax)}
        </p>
      </div>

      <div
        className="relative h-8"
        role="group"
        aria-label={`${label}: ${formatValue(valueMin)} to ${formatValue(valueMax)}`}
      >
        <div className={TRACK_CLASS} aria-hidden />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
          aria-hidden
        />

        <input
          ref={minRef}
          id={`${baseId}-min`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMin}
          onChange={(e) => handleMin(Number(e.target.value))}
          onPointerDown={() => bumpZIndex("min")}
          onFocus={() => bumpZIndex("min")}
          className={cn(rangeInputClass, "z-20")}
          aria-label={`${label} minimum`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={valueMin}
          aria-valuetext={formatValue(valueMin)}
        />
        <input
          ref={maxRef}
          id={`${baseId}-max`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMax}
          onChange={(e) => handleMax(Number(e.target.value))}
          onPointerDown={() => bumpZIndex("max")}
          onFocus={() => bumpZIndex("max")}
          className={cn(rangeInputClass, "z-30")}
          aria-label={`${label} maximum`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={valueMax}
          aria-valuetext={formatValue(valueMax)}
        />

      </div>
    </div>
  )
}
