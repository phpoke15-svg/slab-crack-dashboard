"use client"

import { cn } from "@/lib/utils"

const CRITERIA = [
  { key: "centering", label: "Centering" },
  { key: "corners", label: "Corners" },
  { key: "edges", label: "Edges" },
  { key: "surface", label: "Surface" },
] as const

export type ConditionKey = (typeof CRITERIA)[number]["key"]
export type ConditionState = Record<ConditionKey, number>

export const DEFAULT_CONDITION: ConditionState = {
  centering: 8,
  corners: 8,
  edges: 8,
  surface: 8,
}

interface ConditionLogProps {
  values: ConditionState
  onChange: (key: ConditionKey, value: number) => void
}

export function ConditionLog({ values, onChange }: ConditionLogProps) {
  const avg =
    (values.centering + values.corners + values.edges + values.surface) / 4

  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-foreground">Condition Checklist Log</h4>
          <p className="text-xs text-muted-foreground">Estimate your regrade before you crack.</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Est. grade</span>
          <span className="font-mono text-2xl font-bold text-primary tabular-nums">{avg.toFixed(1)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {CRITERIA.map(({ key, label }) => (
          <div key={key}>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor={`cond-${key}`} className="text-sm font-medium text-foreground">
                {label}
              </label>
              <span className="font-mono text-sm font-semibold text-primary tabular-nums">
                {values[key].toFixed(1)}
              </span>
            </div>
            <input
              id={`cond-${key}`}
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={values[key]}
              onChange={(e) => onChange(key, Number(e.target.value))}
              className={cn(
                "h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary outline-none",
                "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full",
                "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[0_0_12px] [&::-webkit-slider-thumb]:shadow-primary/60",
                "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary",
              )}
              style={{
                background: `linear-gradient(to right, var(--primary) ${((values[key] - 1) / 9) * 100}%, var(--secondary) ${((values[key] - 1) / 9) * 100}%)`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
