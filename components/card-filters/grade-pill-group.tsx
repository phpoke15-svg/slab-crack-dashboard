"use client"

import { cn } from "@/lib/utils"
import type { GradeFilter } from "@/lib/card-filters/types"

const GRADE_OPTIONS: GradeFilter[] = [
  "All Grades",
  "PSA 10",
  "PSA 9",
  "PSA 8",
  "BGS 9.5",
  "BGS 10",
  "CGC 10",
]

type GradePillGroupProps = {
  value: GradeFilter
  onChange: (grade: GradeFilter) => void
  className?: string
}

export function GradePillGroup({ value, onChange, className }: GradePillGroupProps) {
  return (
    <fieldset className={cn("space-y-3", className)}>
      <legend className="text-sm font-medium text-foreground">Grade</legend>
      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="radiogroup"
        aria-label="Card grade filter"
      >
        {GRADE_OPTIONS.map((grade) => {
          const selected = value === grade
          return (
            <button
              key={grade}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(grade)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:bg-card hover:text-foreground",
              )}
            >
              {grade}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
