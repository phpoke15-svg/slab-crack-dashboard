"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { FilterRangeSlider } from "@/components/card-filters/filter-range-slider"
import { GradePillGroup } from "@/components/card-filters/grade-pill-group"
import { filterGradedCards } from "@/lib/card-filters/filter-catalog"
import {
  formatPopLabel,
  POP_MAX,
  popFromPosition,
  positionFromPop,
} from "@/lib/card-filters/pop-scale"
import {
  clampPrice,
  formatPriceLabel,
  formatPriceRange,
  PRICE_MAX,
  PRICE_MIN,
} from "@/lib/card-filters/price-scale"
import type { CardMarketFilterState, GradeFilter, MockGradedCard, SlabPopCard } from "@/lib/card-filters/types"
import { cn } from "@/lib/utils"
import { SlidersHorizontal } from "lucide-react"

const DEFAULT_FILTERS: CardMarketFilterState = {
  maxPop: POP_MAX,
  minPrice: PRICE_MIN,
  maxPrice: PRICE_MAX,
  grade: "All Grades",
}

type CardMarketFilterPanelProps = {
  /** Live or demo graded catalog rows */
  catalog: SlabPopCard[]
  onViewResults?: (matches: SlabPopCard[], filters: CardMarketFilterState) => void
  className?: string
}

/**
 * Graded-card market filter panel with non-linear pop scaling, dual price range,
 * grade pills, and a live result count action button.
 */
export function CardMarketFilterPanel({
  catalog,
  onViewResults,
  className,
}: CardMarketFilterPanelProps) {
  const [filters, setFilters] = useState<CardMarketFilterState>(DEFAULT_FILTERS)
  const [popPosition, setPopPosition] = useState(() => positionFromPop(DEFAULT_FILTERS.maxPop))
  const [matches, setMatches] = useState<MockGradedCard[]>(catalog)

  // Pop slider uses normalized position; sync to filter state on every move.
  const maxPop = useMemo(() => popFromPosition(popPosition), [popPosition])

  useEffect(() => {
    setFilters((prev) => ({ ...prev, maxPop }))
  }, [maxPop])

  useEffect(() => {
    setMatches(filterGradedCards(catalog, filters))
  }, [catalog, filters])

  const resultCount = matches.length
  const resultsDisabled = resultCount === 0

  const popSummary =
    maxPop >= POP_MAX ? "Any pop count" : `Pop under ${formatPopLabel(maxPop)}`
  const priceSummary = formatPriceRange(filters.minPrice, filters.maxPrice)

  return (
    <section
      className={cn(
        "w-full max-w-xl rounded-2xl border border-border bg-card/80 p-4 shadow-xl shadow-black/20 backdrop-blur-sm sm:p-5",
        className,
      )}
      aria-label="Card market filters"
    >
      <header className="mb-5 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <SlidersHorizontal className="size-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground sm:text-lg">Market filters</h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Tune pop report, price, and grade to surface matching slabs.
          </p>
        </div>
      </header>

      <div className="space-y-6">
        {/* Pop report — non-linear single ceiling slider */}
        <PopCeilingSlider
          position={popPosition}
          maxPop={maxPop}
          onPositionChange={setPopPosition}
          summary={popSummary}
        />

        {/* Price — dual linear range */}
        <FilterRangeSlider
          label="Price"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={10}
          valueMin={filters.minPrice}
          valueMax={filters.maxPrice}
          formatValue={(v) => formatPriceLabel(v, { ceiling: true })}
          onChange={({ min, max }) =>
            setFilters((prev) => ({
              ...prev,
              minPrice: clampPrice(min),
              maxPrice: clampPrice(max),
            }))
          }
        />
        <p className="-mt-3 text-xs text-muted-foreground">{priceSummary}</p>

        <GradePillGroup
          value={filters.grade}
          onChange={(grade: GradeFilter) => setFilters((prev) => ({ ...prev, grade }))}
        />
      </div>

      <div className="mt-6 space-y-3 border-t border-border pt-5">
        <p className="text-center text-xs text-muted-foreground" aria-live="polite">
          {resultsDisabled
            ? "No cards match — try widening pop or price range."
            : `${resultCount} card${resultCount === 1 ? "" : "s"} match your filters`}
        </p>

        <Button
          type="button"
          size="lg"
          className="h-11 w-full text-sm font-semibold"
          disabled={resultsDisabled}
          onClick={() => onViewResults?.(matches, filters)}
        >
          {resultsDisabled ? "No Cards Match Criteria" : `View ${resultCount} Matching Card${resultCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </section>
  )
}

type PopCeilingSliderProps = {
  position: number
  maxPop: number
  summary: string
  onPositionChange: (position: number) => void
}

function PopCeilingSlider({ position, maxPop, summary, onPositionChange }: PopCeilingSliderProps) {
  const percent = position * 100

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Pop report</p>
          <p className="text-xs text-muted-foreground">Non-linear scale — fine control below 500</p>
        </div>
        <p className="font-mono text-sm font-semibold text-primary tabular-nums">{summary}</p>
      </div>

      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-secondary" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: 0, right: `${100 - percent}%` }}
          aria-hidden
        />
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(position * 1000)}
          onChange={(e) => onPositionChange(Number(e.target.value) / 1000)}
          className={cn(
            "absolute inset-x-0 top-1/2 h-6 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent",
            "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background",
            "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-black/30",
            "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2",
            "[&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background",
            "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent",
            "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-transparent",
          )}
          aria-label="Maximum population count"
          aria-valuemin={1}
          aria-valuemax={POP_MAX}
          aria-valuenow={maxPop}
          aria-valuetext={summary}
        />
      </div>

      <div className="flex justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>1</span>
        <span>500</span>
        <span>2.5k</span>
        <span>10k+</span>
      </div>
    </div>
  )
}

export { filterGradedCards, DEFAULT_FILTERS }
export type { CardMarketFilterState, SlabPopCard, GradeFilter }
