"use client"

import { cn } from "@/lib/utils"
import {
  resolveSelectedGradeDisplayPrice,
  type ScrydexGradedPrice,
} from "@/lib/grading/quotes"
import { formatSlabLabel, type SlabGradeRef } from "@/lib/grading/types"
import type { MockCardEntry } from "@/lib/slab-data"

type SelectedGradePriceProps = {
  slabGrade: SlabGradeRef
  gradedPrices: ScrydexGradedPrice[]
  card: MockCardEntry
  priced?: boolean
  loading?: boolean
  className?: string
}

export function SelectedGradePrice({
  slabGrade,
  gradedPrices,
  card,
  priced = true,
  loading = false,
  className,
}: SelectedGradePriceProps) {
  const display = resolveSelectedGradeDisplayPrice(gradedPrices, card, slabGrade)

  return (
    <div className={className}>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {formatSlabLabel(slabGrade)}
      </span>
      <span className="ml-2 font-mono text-lg font-semibold tabular-nums text-foreground">
        {loading ? "…" : priced && display.price > 0 ? `$${display.price.toFixed(2)}` : "—"}
      </span>
      {!loading && display.estimated ? (
        <span className="ml-1 text-[10px] text-muted-foreground">est.</span>
      ) : null}
    </div>
  )
}

export function SelectedGradePriceCompact({
  slabGrade,
  gradedPrices,
  card,
  priced = true,
  loading = false,
  className,
}: SelectedGradePriceProps) {
  const display = resolveSelectedGradeDisplayPrice(gradedPrices, card, slabGrade)

  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {formatSlabLabel(slabGrade)}
      </span>
      <span className="font-mono text-base font-semibold tabular-nums text-foreground">
        {loading ? "…" : priced && display.price > 0 ? `$${display.price.toFixed(0)}` : "—"}
      </span>
      {!loading && display.estimated ? (
        <span className="text-[10px] text-muted-foreground">est.</span>
      ) : null}
    </span>
  )
}
