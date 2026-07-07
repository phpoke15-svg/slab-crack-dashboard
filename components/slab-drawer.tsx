"use client"

import { useEffect, useState } from "react"
import { X, ExternalLink, Star, Calculator, Lightbulb, ChevronDown, Activity, BarChart3, ShieldCheck, Receipt } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getBestGradeQuote,
  getDeficitHistory,
  getDeficitTrend,
  getGradeQuotes,
  getPopReport,
  getConfidence,
  mockEntryToSlabCard,
  PSA_GRADE_NUMBERS,
  type MockCardEntry,
  type PsaGradeNumber,
  type RecentSale,
} from "@/lib/slab-data"
import { DeficitBadge } from "@/components/deficit-badge"
import { SlabCardImage } from "@/components/slab-card-image"
import { DeficitSparkline } from "@/components/deficit-sparkline"
import { GradePriceGrid } from "@/components/grade-price-grid"
import { RegradeCalculator } from "@/components/regrade-calculator"
import { RecentSalesList } from "@/components/recent-sales-list"
import { DEFAULT_CONDITION, type ConditionKey, type ConditionState } from "@/components/condition-log"

interface SlabDrawerProps {
  selectedCard: MockCardEntry | null
  watched: boolean
  onClose: () => void
  onToggleWatch: (card: MockCardEntry) => void
}

export function SlabDrawer({ selectedCard, watched, onClose, onToggleWatch }: SlabDrawerProps) {
  const [showLog, setShowLog] = useState(false)
  const [condition, setCondition] = useState<ConditionState>(DEFAULT_CONDITION)
  const [recentRawSales, setRecentRawSales] = useState<RecentSale[]>([])
  const [recentSlabSales, setRecentSlabSales] = useState<RecentSale[]>([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesGrade, setSalesGrade] = useState<PsaGradeNumber>(9)

  useEffect(() => {
    if (selectedCard) {
      setShowLog(false)
      setCondition(DEFAULT_CONDITION)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [selectedCard])

  useEffect(() => {
    if (!selectedCard) {
      setRecentRawSales([])
      setRecentSlabSales([])
      return
    }

    const gradeQuotes = getGradeQuotes(selectedCard)
    const best = getBestGradeQuote(gradeQuotes)
    setSalesGrade(best?.grade ?? 9)
  }, [selectedCard])

  useEffect(() => {
    if (!selectedCard) {
      setRecentRawSales([])
      setRecentSlabSales([])
      return
    }

    const gradeQuotes = getGradeQuotes(selectedCard)
    const quote = gradeQuotes.find((item) => item.grade === salesGrade)

    if (selectedCard.recentRawSales?.length || quote?.recentSlabSales?.length) {
      setRecentRawSales(selectedCard.recentRawSales ?? [])
      setRecentSlabSales(quote?.recentSlabSales ?? [])
      return
    }

    let cancelled = false
    setSalesLoading(true)

    fetch(`/api/card-sales?id=${selectedCard.id}&grade=${salesGrade}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { recentRawSales?: RecentSale[]; recentSlabSales?: RecentSale[] } | null) => {
        if (cancelled || !data) return
        setRecentRawSales(data.recentRawSales ?? [])
        setRecentSlabSales(data.recentSlabSales ?? [])
      })
      .catch(() => {
        if (!cancelled) {
          setRecentRawSales([])
          setRecentSlabSales([])
        }
      })
      .finally(() => {
        if (!cancelled) setSalesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedCard, salesGrade])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (!selectedCard) return null

  const priced = selectedCard.hasPricing !== false
  const pricingLoading = selectedCard.marketInsight === "Loading PSA 7–10 comps…"
  const gradeQuotes = getGradeQuotes(selectedCard)
  const best = getBestGradeQuote(gradeQuotes)
  const activeQuote = gradeQuotes.find((q) => q.grade === salesGrade) ?? best
  const slabCard = mockEntryToSlabCard(selectedCard)
  const history = priced ? getDeficitHistory(slabCard) : []
  const trend = priced ? getDeficitTrend(slabCard) : ("stable" as const)
  const pop = getPopReport(slabCard)
  const gradePop = pop[salesGrade] ?? 0
  const confidence = priced ? getConfidence(slabCard) : null
  const handleCondition = (key: ConditionKey, value: number) =>
    setCondition((prev) => ({ ...prev, [key]: value }))

  const trendLabel =
    trend === "widening"
      ? "Gap widening"
      : trend === "closing"
        ? "Gap closing"
        : "Holding steady"

  const confidenceColor: Record<string, string> = {
    high: "text-primary border-primary/30 bg-primary/10",
    medium: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    low: "text-destructive border-destructive/30 bg-destructive/10",
  }

  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${selectedCard.cardName} ${selectedCard.cardNumber} PSA ${salesGrade}`)}`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${selectedCard.cardName} details`}
        className={cn(
          "relative flex max-h-[92vh] w-full max-w-lg animate-slide-up flex-col overflow-hidden rounded-t-3xl border border-border bg-popover",
          "sm:rounded-3xl",
        )}
      >
        {/* Grabber + close */}
        <div className="relative flex items-center justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-border sm:hidden" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">
          {/* Header */}
          <div className="flex gap-4">
            <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-lg sm:w-28">
              <SlabCardImage
                card={selectedCard}
                alt={`${selectedCard.cardName} card artwork`}
                sizes="(max-width: 640px) 112px, 128px"
                className="object-contain p-1"
                upgrade
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-bold text-foreground">{selectedCard.cardName}</h2>
                <span className="shrink-0 font-mono text-sm text-muted-foreground">
                  {selectedCard.cardNumber}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{selectedCard.setName}</p>
              <div className="mt-3">
                {pricingLoading ? (
                  <p className="text-sm text-muted-foreground">Loading PSA 7–10 comps…</p>
                ) : priced && activeQuote?.isArbitrage ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      PSA {salesGrade} vs raw NM
                    </span>
                    <DeficitBadge diff={-activeQuote.deficit} pct={-activeQuote.percentageSavings} size="lg" />
                  </div>
                ) : priced && activeQuote && activeQuote.slabPrice > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    PSA {salesGrade} slab is at or above raw — no arbitrage gap.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Run sync-prices to load raw vs slab comps for this card.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Raw NM</span>
              <span className="font-mono text-lg font-semibold text-foreground tabular-nums">
                {priced && selectedCard.rawPrice > 0 ? `$${selectedCard.rawPrice.toFixed(2)}` : "—"}
              </span>
            </div>
            <GradePriceGrid
              quotes={gradeQuotes}
              priced={priced && !pricingLoading}
              selectedGrade={salesGrade}
              onSelectGrade={setSalesGrade}
              highlightBest={false}
            />
          </div>

          {/* Recent eBay sold comps */}
          <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Receipt className="size-4 text-primary" />
                <h4 className="font-semibold text-foreground">Recent eBay Sales</h4>
              </div>
              <div className="flex gap-1">
                {PSA_GRADE_NUMBERS.map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => setSalesGrade(grade)}
                    className={cn(
                      "rounded-md border px-2 py-1 font-mono text-[10px] font-semibold transition-colors",
                      salesGrade === grade
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>

            {salesLoading ? (
              <p className="text-xs text-muted-foreground">Loading sold comps…</p>
            ) : (
              <div className="flex flex-col gap-4">
                <RecentSalesList
                  title={`PSA ${salesGrade} — last 5 sold`}
                  sales={recentSlabSales}
                  emptyMessage="Run price sync or add EBAY_SOLD_API_KEY to load live comps."
                />
                <RecentSalesList
                  title="Raw NM — last 5 sold"
                  sales={recentRawSales}
                  emptyMessage="No raw sold comps matched this search."
                />
              </div>
            )}
          </div>

          {/* Deal intelligence */}
          {priced && confidence && (
          <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <h4 className="font-semibold text-foreground">Deal Intelligence</h4>
            </div>

            {/* Deficit trend */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 p-3">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  30-day deficit trend
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    trend === "widening"
                      ? "text-primary"
                      : trend === "closing"
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {trendLabel}
                </span>
              </div>
              <DeficitSparkline data={history} trend={trend} />
            </div>

            {/* Pop + confidence */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card/60 p-3">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <BarChart3 className="size-3.5 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    PSA {salesGrade} Pop
                  </span>
                </div>
                <p className="font-mono text-lg font-semibold text-foreground tabular-nums">
                  {gradePop.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  PSA 10 pop {pop[10].toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card/60 p-3">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Comp confidence
                  </span>
                </div>
                <span
                  className={cn(
                    "inline-flex rounded-md border px-1.5 py-0.5 text-xs font-semibold",
                    confidenceColor[confidence.level],
                  )}
                >
                  {confidence.label}
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {confidence.sales} recent sales
                </p>
              </div>
            </div>
          </div>
          )}

          {/* Market insights */}
          <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="mb-1.5 flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" />
              <h4 className="font-semibold text-foreground">Market Insights</h4>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{selectedCard.marketInsight}</p>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-col gap-2.5">
            <a
              href={ebayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <ExternalLink className="size-4" />
              Search eBay Slabs
            </a>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onToggleWatch(selectedCard)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium transition-colors",
                  watched
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-secondary text-foreground hover:border-primary/40",
                )}
              >
                <Star className={cn("size-4", watched && "fill-primary")} />
                {watched ? "Watching" : "Add to Watchlist"}
              </button>

              <button
                type="button"
                onClick={() => setShowLog((s) => !s)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium transition-colors",
                  showLog
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-secondary text-foreground hover:border-primary/40",
                )}
                aria-expanded={showLog}
              >
                <Calculator className="size-4" />
                Regrade ROI
                <ChevronDown className={cn("size-4 transition-transform", showLog && "rotate-180")} />
              </button>
            </div>
          </div>

          {/* Regrade ROI calculator */}
          {showLog && (
            <div className="mt-4 animate-fade-in">
              <RegradeCalculator card={slabCard} condition={condition} onChange={handleCondition} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
