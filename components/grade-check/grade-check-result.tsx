"use client"

import { useState } from "react"
import Image from "next/image"
import { ShieldCheck, TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { GradePriceGrid } from "@/components/grade-price-grid"
import {
  computeRegradeROI,
  getGradeQuotes,
  GRADING_TIERS,
  mockEntryToSlabCard,
  PSA_GRADE_NUMBERS,
  type MockCardEntry,
} from "@/lib/slab-data"
import {
  confidenceLabel,
  effectiveGradeCondition,
  estimateGradeBand,
  type ExtendedGradeCondition,
} from "@/lib/grade-estimate"

type GradeCheckResultProps = {
  card: MockCardEntry
  condition: ExtendedGradeCondition
  frontPhoto: string | null
}

export function GradeCheckResult({ card, condition, frontPhoto }: GradeCheckResultProps) {
  const [tierId, setTierId] = useState("regular")
  const tier = GRADING_TIERS.find((item) => item.id === tierId) ?? GRADING_TIERS[1]

  const effective = effectiveGradeCondition(condition)
  const band = estimateGradeBand(effective)
  const slabCard = mockEntryToSlabCard(card)
  const roi = computeRegradeROI(slabCard, band.point, tier.fee)
  const gradeQuotes = getGradeQuotes(card)
  const priced = card.hasPricing !== false

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
          <h3 className="mb-3 font-semibold text-foreground">Live PSA comps</h3>
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Raw NM reference</span>
            <span className="font-mono font-semibold text-foreground">
              {card.rawPrice > 0 ? money(card.rawPrice) : "—"}
            </span>
          </div>
          <GradePriceGrid quotes={gradeQuotes} priced={priced} />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Highlighted grade is your midpoint estimate (PSA {band.point}).
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-secondary/30 p-4">
        <h3 className="mb-3 font-semibold text-foreground">Submit for grading?</h3>
        <div className="grid grid-cols-3 gap-2">
          {GRADING_TIERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTierId(item.id)}
              className={cn(
                "rounded-xl border px-2 py-2 text-center transition-colors",
                item.id === tierId
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-card/50 text-muted-foreground",
              )}
            >
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="font-mono text-xs">${item.fee}</p>
            </button>
          ))}
        </div>

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
