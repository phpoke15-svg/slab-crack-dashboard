"use client"

import { cn } from "@/lib/utils"
import {
  buildSlabQuotesForCompany,
  pickGradedPrice,
  type ScrydexGradedPrice,
} from "@/lib/grading/quotes"
import { DEFAULT_SLAB_GRADE, type GradingCompany, type SlabGradeRef } from "@/lib/grading/types"

interface CompanyGradePriceGridProps {
  company: GradingCompany
  gradedPrices: ScrydexGradedPrice[]
  rawPrice: number
  priced?: boolean
  compact?: boolean
  selected?: SlabGradeRef | null
}

export function CompanyGradePriceGrid({
  company,
  gradedPrices,
  rawPrice,
  priced = true,
  compact = false,
  selected = null,
}: CompanyGradePriceGridProps) {
  const gradeRef = selected ?? { ...DEFAULT_SLAB_GRADE, company }
  const quotes = buildSlabQuotesForCompany(rawPrice, gradedPrices, gradeRef.company)
  const quote = quotes.find((row) => row.grade === gradeRef.grade)
  const hasPrice =
    priced &&
    ((quote?.slabPrice ?? 0) > 0 ||
      (pickGradedPrice(gradedPrices, gradeRef) ?? 0) > 0)

  return (
    <div
      className={cn(
        "rounded-lg border border-primary/60 bg-primary/15 p-2 text-center ring-1 ring-primary/40 sm:p-3",
        compact && "p-1.5 sm:p-2",
      )}
    >
      <span className="inline-block rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-primary sm:text-[10px]">
        {gradeRef.company} {gradeRef.grade}
      </span>
      <p
        className={cn(
          "mt-1 font-mono font-semibold tabular-nums",
          compact ? "text-xs" : "text-sm",
          hasPrice ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {hasPrice && quote && quote.slabPrice > 0 ? `$${quote.slabPrice.toFixed(0)}` : "—"}
      </p>
      {quote?.isArbitrage ? (
        <p
          className={cn(
            "mt-0.5 font-mono font-semibold tabular-nums text-primary",
            compact ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-xs",
          )}
        >
          -${quote.deficit.toFixed(0)}
        </p>
      ) : hasPrice ? (
        <p className="mt-0.5 font-mono text-[9px] text-muted-foreground sm:text-[10px]">No gap</p>
      ) : (
        <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/60 sm:text-[10px]">—</p>
      )}
    </div>
  )
}
