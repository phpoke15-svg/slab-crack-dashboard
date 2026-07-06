"use client"

import { useState } from "react"
import { Calculator, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  computeRegradeROI,
  GRADING_TIERS,
  SUBMISSION_OVERHEAD,
  type SlabCard,
} from "@/lib/slab-data"
import {
  ConditionLog,
  type ConditionKey,
  type ConditionState,
} from "@/components/condition-log"

interface RegradeCalculatorProps {
  card: SlabCard
  condition: ConditionState
  onChange: (key: ConditionKey, value: number) => void
}

export function RegradeCalculator({ card, condition, onChange }: RegradeCalculatorProps) {
  const [tierId, setTierId] = useState("regular")
  const tier = GRADING_TIERS.find((t) => t.id === tierId) ?? GRADING_TIERS[1]

  const avg =
    (condition.centering + condition.corners + condition.edges + condition.surface) / 4
  const roi = computeRegradeROI(card, avg, tier.fee)

  const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`

  return (
    <div className="flex flex-col gap-4">
      <ConditionLog values={condition} onChange={onChange} />

      {/* Grading service selector */}
      <div className="rounded-2xl border border-border bg-secondary/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calculator className="size-4 text-primary" />
          <h4 className="font-semibold text-foreground">Regrade ROI Calculator</h4>
        </div>

        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Grading service
        </span>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {GRADING_TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTierId(t.id)}
              className={cn(
                "flex flex-col items-center rounded-xl border px-2 py-2 transition-colors",
                t.id === tierId
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:border-primary/30",
              )}
              aria-pressed={t.id === tierId}
            >
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="font-mono text-xs">{"$"}{t.fee}</span>
              <span className="text-[10px] text-muted-foreground">{t.turnaround}</span>
            </button>
          ))}
        </div>

        {/* Cost breakdown */}
        <dl className="mt-4 flex flex-col gap-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Raw purchase (NM)</dt>
            <dd className="font-mono text-foreground">{money(card.rawValue)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Grading fee ({tier.label})</dt>
            <dd className="font-mono text-foreground">{money(tier.fee)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Shipping &amp; supplies</dt>
            <dd className="font-mono text-foreground">{money(SUBMISSION_OVERHEAD)}</dd>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
            <dt className="font-medium text-foreground">All-in cost</dt>
            <dd className="font-mono font-semibold text-foreground">{money(roi.cost)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              Projected value @ PSA {roi.estGrade}
            </dt>
            <dd className="font-mono text-foreground">{money(roi.projectedValue)}</dd>
          </div>
        </dl>

        {/* Verdict */}
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
            <div className="flex flex-col">
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wide",
                  roi.profitable ? "text-primary/70" : "text-destructive/70",
                )}
              >
                Net profit
              </span>
              <span
                className={cn(
                  "font-mono text-lg font-bold tabular-nums",
                  roi.profitable ? "text-primary" : "text-destructive",
                )}
              >
                {money(roi.netProfit)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span
              className={cn(
                "text-[10px] uppercase tracking-wide",
                roi.profitable ? "text-primary/70" : "text-destructive/70",
              )}
            >
              ROI
            </span>
            <span
              className={cn(
                "font-mono text-lg font-bold tabular-nums",
                roi.profitable ? "text-primary" : "text-destructive",
              )}
            >
              {roi.roiPct >= 0 ? "+" : ""}
              {roi.roiPct.toFixed(0)}%
            </span>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Estimates only. Projected value assumes your condition inputs match PSA&apos;s
          grade. Actual grades and market prices vary.
        </p>
      </div>
    </div>
  )
}
