"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { ShieldCheck, TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { CompanyGradePriceGrid } from "@/components/grading/company-grade-price-grid"
import { SlabGradeSelector } from "@/components/grading/slab-grade-selector"
import { PriceHistoryChart } from "@/components/price-history-chart"
import { pickGradedPrice, resolveGradedPricesForCard } from "@/lib/grading/quotes"
import { DEFAULT_SLAB_GRADE, historyChartGradeProps, type SlabGradeRef } from "@/lib/grading/types"
import {
  computeRegradeROI,
  mockEntryToSlabCard,
  PSA_GRADE_NUMBERS,
  type MockCardEntry,
} from "@/lib/slab-data"
import {
  DEFAULT_PSA_GRADING_TIER_ID,
  findPsaGradingTier,
  formatPsaFee,
  PSA_GRADING_TIERS,
} from "@/lib/psa-grading-tiers"
import {
  confidenceLabel,
  effectiveGradeCondition,
  estimateGradeBand,
  type ExtendedGradeCondition,
} from "@/lib/grade-estimate"
import { AdSlot } from "@/components/ad-slot"

type GradeCheckResultProps = {
  card: MockCardEntry
  condition: ExtendedGradeCondition
  frontPhoto: string | null
}

export function GradeCheckResult({ card, condition, frontPhoto }: GradeCheckResultProps) {
  const [tierId, setTierId] = useState(DEFAULT_PSA_GRADING_TIER_ID)
  const [slabGrade, setSlabGrade] = useState<SlabGradeRef>(DEFAULT_SLAB_GRADE)
  const tier = findPsaGradingTier(tierId) ?? PSA_GRADING_TIERS.find((t) => t.id === "regular")!

  const effective = effectiveGradeCondition(condition)
  const band = estimateGradeBand(effective)
  const slabCard = mockEntryToSlabCard(card)
  const roi = computeRegradeROI(slabCard, band.point, tier.fee)
  const gradedPrices = useMemo(() => resolveGradedPricesForCard(undefined, card), [card])
  const priced = card.hasPricing !== false
  const displayGrade =
    slabGrade.company === "PSA" ? { company: "PSA" as const, grade: String(band.point) } : slabGrade
  const displaySlabPrice = pickGradedPrice(gradedPrices, displayGrade) ?? 0
  const chartGradeProps = historyChartGradeProps(displayGrade)

  const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-lg border border-white/10">
            <Image
              src={frontPhoto || card.imageUrl || "/placeholder.svg"}
              alt=""
              fill
              className="object-cover"
              unoptimized={Boolean(frontPhoto)}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">{card.cardName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {card.setName}
              {card.cardNumber ? ` · ${card.cardNumber}` : ""}
            </p>
            <p className="mt-2 font-mono text-2xl font-bold text-primary">{band.label}</p>
            <p className="text-xs text-muted-foreground">{confidenceLabel(band.confidence)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-secondary/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <h3 className="font-semibold text-foreground">Subgrade breakdown</h3>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {(["centering", "corners", "edges", "surface"] as const).map((key) => (
            <div key={key} className="flex items-center justify-between rounded-lg bg-card/50 px-3 py-2">
              <dt className="capitalize text-muted-foreground">{key}</dt>
              <dd className="font-mono font-semibold text-foreground tabular-nums">
                {effective[key].toFixed(1)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {priced && (
        <div className="rounded-2xl border border-border bg-secondary/30 p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h3 className="font-semibold text-foreground">Live graded comps</h3>
            <SlabGradeSelector value={slabGrade} onChange={setSlabGrade} available={gradedPrices} compact />
          </div>
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Raw NM reference</span>
            <span className="font-mono font-semibold text-foreground">
              {card.rawPrice > 0 ? money(card.rawPrice) : "—"}
            </span>
          </div>
          <CompanyGradePriceGrid
            company={slabGrade.company}
            gradedPrices={gradedPrices}
            rawPrice={card.rawPrice}
            priced={priced}
            selected={displayGrade}
          />
          <div className="mt-3">
            <PriceHistoryChart
              cardId={card.id}
              {...chartGradeProps}
              currentRaw={card.rawPrice}
              currentSlab={displaySlabPrice}
              compact
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Highlighted grade is your midpoint estimate (PSA {band.point}).
          </p>
        </div>
      )}

      <AdSlot variant="result" slotIndex={1} />

      <div className="rounded-2xl border border-border bg-secondary/30 p-4">
        <h3 className="mb-3 font-semibold text-foreground">Submit for grading?</h3>
        <div className="flex flex-wrap gap-2">
          {PSA_GRADING_TIERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTierId(item.id)}
              className={cn(
                "min-w-[4.5rem] flex-1 rounded-xl border px-2 py-2 text-center transition-colors sm:flex-none",
                item.id === tierId
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : item.available
                    ? "border-border bg-card/50 text-muted-foreground"
                    : "border-dashed border-border/70 bg-card/30 text-muted-foreground/80",
              )}
            >
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="font-mono text-xs">{formatPsaFee(item.fee)}</p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                {item.available ? item.turnaround : "Paused"}
              </p>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Prices match current PSA service levels. Value tiers are paused by PSA but remain selectable for modeling.
        </p>

        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">All-in cost @ PSA {band.point}</dt>
            <dd className="font-mono text-foreground">{money(roi.cost)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Projected slab value</dt>
            <dd className="font-mono text-foreground">{money(roi.projectedValue)}</dd>
          </div>
        </dl>

        <div
          className={cn(
            "mt-3 flex items-center justify-between rounded-xl border p-3",
            roi.profitable
              ? "border-primary/40 bg-primary/10"
              : "border-destructive/40 bg-destructive/10",
          )}
        >
          <div className="flex items-center gap-2">
            {roi.profitable ? (
              <TrendingUp className="size-5 text-primary" />
            ) : (
              <TrendingDown className="size-5 text-destructive" />
            )}
            <span className={cn("font-mono text-lg font-bold", roi.profitable ? "text-primary" : "text-destructive")}>
              {money(roi.netProfit)}
            </span>
          </div>
          <span className={cn("font-mono text-sm font-semibold", roi.profitable ? "text-primary" : "text-destructive")}>
            {roi.roiPct >= 0 ? "+" : ""}
            {roi.roiPct.toFixed(0)}% ROI
          </span>
        </div>
      </div>

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        Estimate only — not affiliated with PSA, CGC, or BGS. Final grades depend on human graders.
        {priced ? "" : " Load pricing via card lookup for dollar estimates."}
      </p>

      <div className="flex flex-wrap justify-center gap-2 text-[10px] text-muted-foreground">
        {PSA_GRADE_NUMBERS.map((grade) => (
          <span key={grade} className="rounded-full border border-border px-2 py-0.5">
            PSA {grade} considered
          </span>
        ))}
      </div>
    </div>
  )
}
