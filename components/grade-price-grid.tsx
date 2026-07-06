"use client"

import { cn } from "@/lib/utils"
import type { GradeQuote } from "@/lib/slab-data"
import { PSA_GRADE_NUMBERS } from "@/lib/slab-data"

const gradeColor: Record<number, string> = {
  7: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  8: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  9: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
}

interface GradePriceGridProps {
  quotes: GradeQuote[]
  priced?: boolean
  compact?: boolean
  highlightBest?: boolean
}

export function GradePriceGrid({
  quotes,
  priced = true,
  compact = false,
  highlightBest = true,
}: GradePriceGridProps) {
  const bestDeficit = highlightBest
    ? Math.max(...quotes.filter((quote) => quote.isArbitrage).map((quote) => quote.deficit), 0)
    : 0

  return (
    <div className={cn("grid grid-cols-3 gap-1.5", compact ? "gap-1" : "gap-1.5 sm:gap-2")}>
      {PSA_GRADE_NUMBERS.map((grade) => {
        const quote = quotes.find((item) => item.grade === grade)
        const isBest = quote?.isArbitrage && quote.deficit === bestDeficit && bestDeficit > 0

        return (
          <div
            key={grade}
            className={cn(
              "rounded-lg border p-1.5 text-center sm:p-2",
              isBest ? "border-primary/50 bg-primary/10" : "border-border bg-secondary/30",
            )}
          >
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
              <p className="mt-0.5 font-mono text-[9px] font-semibold text-primary tabular-nums sm:text-[10px]">
                -${quote.deficit.toFixed(0)}
              </p>
            ) : (
              <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/60 sm:text-[10px]">—</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
