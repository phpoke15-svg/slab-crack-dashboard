"use client"

import { cn } from "@/lib/utils"
import type { GradeQuote, PsaGradeNumber } from "@/lib/slab-data"
import { PSA_GRADE_NUMBERS } from "@/lib/slab-data"

const gradeColor: Record<number, string> = {
  7: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  8: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  9: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  10: "text-violet-300 border-violet-400/30 bg-violet-400/10",
}

interface GradePriceGridProps {
  quotes: GradeQuote[]
  priced?: boolean
  compact?: boolean
  highlightBest?: boolean
  selectedGrade?: PsaGradeNumber | null
  onSelectGrade?: (grade: PsaGradeNumber) => void
}

export function GradePriceGrid({
  quotes,
  priced = true,
  compact = false,
  highlightBest = true,
  selectedGrade = null,
  onSelectGrade,
}: GradePriceGridProps) {
  const bestDeficit = highlightBest
    ? Math.max(...quotes.filter((quote) => quote.isArbitrage).map((quote) => quote.deficit), 0)
    : 0

  return (
    <div className={cn("grid grid-cols-4 gap-1", compact ? "gap-1" : "gap-1.5 sm:gap-2")}>
      {PSA_GRADE_NUMBERS.map((grade) => {
        const quote = quotes.find((item) => item.grade === grade)
        const isSelected = selectedGrade === grade
        const isBest =
          !isSelected &&
          selectedGrade == null &&
          quote?.isArbitrage &&
          quote.deficit === bestDeficit &&
          bestDeficit > 0

        const cellClass = cn(
          "rounded-lg border p-1.5 text-center transition-colors sm:p-2",
          isSelected
            ? "border-primary/60 bg-primary/15 ring-1 ring-primary/40"
            : isBest
              ? "border-primary/50 bg-primary/10"
              : "border-border bg-secondary/30",
          onSelectGrade && "cursor-pointer hover:border-primary/40 hover:bg-primary/5",
        )

        const content = (
          <>
            <span
              className={cn(
                "inline-block rounded border px-1 py-0.5 font-mono text-[9px] font-semibold sm:text-[10px]",
                gradeColor[grade],
              )}
            >
              PSA {grade}
            </span>
            <p
              className={cn(
                "mt-1 font-mono font-semibold tabular-nums",
                compact ? "text-xs" : "text-sm",
                quote && quote.slabPrice > 0 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {quote && quote.slabPrice > 0 ? `$${quote.slabPrice.toFixed(0)}` : "—"}
            </p>
            {quote?.isArbitrage ? (
              <p
                className={cn(
                  "mt-0.5 font-mono font-semibold tabular-nums",
                  compact ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-xs",
                  isSelected ? "text-primary" : "text-primary/80",
                )}
              >
                -${quote.deficit.toFixed(0)}
              </p>
            ) : quote && quote.slabPrice > 0 ? (
              <p className="mt-0.5 font-mono text-[9px] text-muted-foreground sm:text-[10px]">No gap</p>
            ) : (
              <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/60 sm:text-[10px]">—</p>
            )}
          </>
        )

        if (onSelectGrade) {
          return (
            <button
              key={grade}
              type="button"
              aria-pressed={isSelected}
              aria-label={`PSA ${grade}, slab ${quote?.slabPrice ? `$${quote.slabPrice.toFixed(0)}` : "no price"}${quote?.isArbitrage ? `, deficit $${quote.deficit.toFixed(0)}` : ""}`}
              onClick={(e) => {
                e.stopPropagation()
                onSelectGrade(grade)
              }}
              className={cellClass}
            >
              {content}
            </button>
          )
        }

        return (
          <div key={grade} className={cellClass}>
            {content}
          </div>
        )
      })}
    </div>
  )
}
