"use client"

import { cn } from "@/lib/utils"
import {
  effectiveGradeCondition,
  estimateGradeBand,
  type ExtendedGradeCondition,
} from "@/lib/grade-estimate"

const CORE = [
  { key: "corners", label: "Corners" },
  { key: "edges", label: "Edges" },
  { key: "surface", label: "Surface" },
] as const

const EXTRA = [
  { key: "whitening", label: "Whitening / chips" },
  { key: "scratches", label: "Scratches" },
  { key: "holoWear", label: "Holo / print lines" },
] as const

type GradeCheckConditionProps = {
  values: ExtendedGradeCondition
  onChange: (values: ExtendedGradeCondition) => void
}

function SliderRow({
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
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <span className="font-mono text-sm font-semibold text-primary tabular-nums">
          {value.toFixed(1)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary outline-none",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:bg-primary",
        )}
        style={{
          background: `linear-gradient(to right, var(--primary) ${((value - 1) / 9) * 100}%, var(--secondary) ${((value - 1) / 9) * 100}%)`,
        }}
      />
    </div>
  )
}

export function GradeCheckCondition({ values, onChange }: GradeCheckConditionProps) {
  const effective = effectiveGradeCondition(values)
  const band = estimateGradeBand(effective)

  const set = (key: keyof ExtendedGradeCondition, value: number) =>
    onChange({ ...values, [key]: value })

  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Condition checklist</h3>
          <p className="text-xs text-muted-foreground">
            Centering is set from your photo. Rate the rest under good lighting.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Est. band</p>
          <p className="font-mono text-xl font-bold text-primary">{band.label}</p>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
        Centering subgrade:{" "}
        <span className="font-mono font-semibold text-foreground">{values.centering.toFixed(1)}</span>
      </div>

      <div className="flex flex-col gap-4">
        {CORE.map(({ key, label }) => (
          <SliderRow
            key={key}
            id={`grade-${key}`}
            label={label}
            value={values[key]}
            onChange={(value) => set(key, value)}
          />
        ))}

        <div className="border-t border-border pt-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Defect caps
          </p>
          <div className="flex flex-col gap-4">
            {EXTRA.map(({ key, label }) => (
              <SliderRow
                key={key}
                id={`grade-${key}`}
                label={label}
                value={values[key]}
                onChange={(value) => set(key, value)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
