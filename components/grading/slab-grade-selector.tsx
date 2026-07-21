"use client"

import { cn } from "@/lib/utils"
import {
  GRADING_COMPANIES,
  type GradingCompany,
  type SlabGradeRef,
  coerceSlabGradeRef,
  formatSlabLabel,
  gradesForCompany,
} from "@/lib/grading/types"

type SlabGradeSelectorProps = {
  value: SlabGradeRef
  onChange: (value: SlabGradeRef) => void
  available?: Array<{ company: string; grade: string }>
  className?: string
  compact?: boolean
  label?: string
}

export function SlabGradeSelector({
  value,
  onChange,
  available,
  className,
  compact = false,
  label = "Grading",
}: SlabGradeSelectorProps) {
  const gradeOptions = gradesForCompany(value.company, available)

  return (
    <div className={cn("flex flex-wrap items-end gap-2", className)}>
      <label className={cn("flex flex-col gap-1", compact ? "min-w-[5.5rem]" : "min-w-[6.5rem]")}>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label} company
        </span>
        <select
          value={value.company}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const company = event.target.value as GradingCompany
            onChange(coerceSlabGradeRef(company, value.grade, available))
          }}
          className={cn(
            "rounded-lg border border-border bg-background px-2 py-1.5 font-medium text-foreground",
            compact ? "text-xs" : "text-sm",
          )}
          aria-label="Grading company"
        >
          {GRADING_COMPANIES.map((company) => (
            <option key={company} value={company}>
              {company}
            </option>
          ))}
        </select>
      </label>

      <label className={cn("flex flex-col gap-1", compact ? "min-w-[4.5rem]" : "min-w-[5.5rem]")}>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Grade
        </span>
        <select
          value={value.grade}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            onChange({ company: value.company, grade: event.target.value })
          }}
          className={cn(
            "rounded-lg border border-border bg-background px-2 py-1.5 font-mono font-semibold text-foreground",
            compact ? "text-xs" : "text-sm",
          )}
          aria-label={`${value.company} grade`}
        >
          {gradeOptions.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
      </label>

      <span className="hidden pb-1.5 text-[11px] text-muted-foreground sm:inline">
        {formatSlabLabel(value)}
      </span>
    </div>
  )
}
