"use client"

import { cn } from "@/lib/utils"
import {
  buildSlabQuotesForCompany,
  pickGradedPrice,
  type ScrydexGradedPrice,
  type SlabGradeQuote,
} from "@/lib/grading/quotes"
import {
  type GradingCompany,
  type SlabGradeRef,
  gradesForCompany,
} from "@/lib/grading/types"

const GRID_GRADE_COLORS = [
  "text-amber-400 border-amber-400/30 bg-amber-400/10",
  "text-sky-400 border-sky-400/30 bg-sky-400/10",
  "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  "text-violet-400 border-violet-400/30 bg-violet-400/10",
  "text-rose-400 border-rose-400/30 bg-rose-400/10",
  "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",
]

function gridGradesForCompany(company: GradingCompany, gradedPrices: ScrydexGradedPrice[]): string[] {
  const all = gradesForCompany(company, gradedPrices)
  const withoutTop = all.filter((grade) => grade !== "10" && grade !== "10 BL" && grade !== "10 Pristine")
  return withoutTop.length > 0 ? withoutTop.slice(0, 6) : all.slice(0, 6)
}

interface CompanyGradePriceGridProps {
  company: GradingCompany
  gradedPrices: ScrydexGradedPrice[]
  rawPrice: number
  priced?: boolean
  compact?: boolean
  highlightBest?: boolean
  selected?: SlabGradeRef | null
  onSelectGrade?: (ref: SlabGradeRef) => void
}

export function CompanyGradePriceGrid({
  company,
  gradedPrices,
  rawPrice,
  priced = true,
  compact = false,
  highlightBest = true,
  selected = null,
  onSelectGrade,
}: CompanyGradePriceGridProps) {
  const quotes = buildSlabQuotesForCompany(rawPrice, gradedPrices, company)
  const gridGrades = gridGradesForCompany(company, gradedPrices)
  const bestDeficit = highlightBest
    ? Math.max(...quotes.filter((quote) => quote.isArbitrage).map((quote) => quote.deficit), 0)
    : 0

  const quoteForGrade = (grade: string): SlabGradeQuote | undefined =>
    quotes.find((quote) => quote.grade === grade)

  const cols = Math.min(gridGrades.length, 3)

  return (
    <div
      className={cn("grid gap-1", compact ? "gap-1" : "gap-1.5 sm:gap-2")}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {gridGrades.map((grade, index) => {
        const quote = quoteForGrade(grade)
        const isSelected = selected?.company === company && selected?.grade === grade
        const isBest =
          !isSelected &&
          selected == null &&
          quote?.isArbitrage &&
          quote.deficit === bestDeficit &&
          bestDeficit > 0
        const hasPrice =
          priced &&
          ((quote?.slabPrice ?? 0) > 0 ||
            (pickGradedPrice(gradedPrices, { company, grade }) ?? 0) > 0)

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
                GRID_GRADE_COLORS[index % GRID_GRADE_COLORS.length],
              )}
            >
              {company} {grade}
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
                  "mt-0.5 font-mono font-semibold tabular-nums",
                  compact ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-xs",
                  isSelected ? "text-primary" : "text-primary/80",
                )}
              >
                -${quote.deficit.toFixed(0)}
              </p>
            ) : hasPrice ? (
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
              aria-label={`${company} ${grade}, slab ${quote?.slabPrice ? `$${quote.slabPrice.toFixed(0)}` : "no price"}${quote?.isArbitrage ? `, deficit $${quote.deficit.toFixed(0)}` : ""}`}
              onClick={(event) => {
                event.stopPropagation()
                onSelectGrade({ company, grade })
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
