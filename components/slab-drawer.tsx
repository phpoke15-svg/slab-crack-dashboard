"use client"

import { useEffect, useState } from "react"
import {
  X,
  ExternalLink,
  Star,
  Calculator,
  Lightbulb,
  ChevronDown,
  Activity,
  ShieldCheck,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getBestGradeQuote,
  getConfidence,
  getGradeQuotes,
  mockEntryToSlabCard,
  type DeficitTrend,
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
import { ebaySearchUrl } from "@/lib/ebay-affiliate"

interface SlabDrawerProps {
  selectedCard: MockCardEntry | null
  watched: boolean
  onClose: () => void
  onToggleWatch: (card: MockCardEntry) => void
}

type DeficitHistoryResponse = {
  history: number[]
  trend: DeficitTrend
  building?: boolean
  error?: string
}

type CardSalesResponse = {
  recentRawSales?: RecentSale[]
  recentSlabSales?: RecentSale[]
  error?: string
}

export function SlabDrawer({ selectedCard, watched, onClose, onToggleWatch }: SlabDrawerProps) {
  const [showLog, setShowLog] = useState(false)
  const [condition, setCondition] = useState<ConditionState>(DEFAULT_CONDITION)
  const [salesGrade, setSalesGrade] = useState<PsaGradeNumber>(9)
  const [history, setHistory] = useState<number[]>([])
  const [trend, setTrend] = useState<DeficitTrend>("building")
  const [historyLoading, setHistoryLoading] = useState(false)
  const [liveRawSales, setLiveRawSales] = useState<RecentSale[] | null>(null)
  const [liveSlabSales, setLiveSlabSales] = useState<RecentSale[] | null>(null)
  const [salesLoading, setSalesLoading] = useState(false)

  useEffect(() => {
    if (selectedCard) {
      setShowLog(false)
      setCondition(DEFAULT_CONDITION)
      setLiveRawSales(null)
      setLiveSlabSales(null)
      setHistory([])
      setTrend("building")
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [selectedCard])

  useEffect(() => {
    if (!selectedCard) return

    const gradeQuotes = getGradeQuotes(selectedCard).filter((q) => q.grade !== 10)
    const best = getBestGradeQuote(gradeQuotes)
    setSalesGrade(best?.grade === 10 ? 9 : (best?.grade ?? 9))
  }, [selectedCard])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    if (!selectedCard || selectedCard.hasPricing === false) {
      setHistory([])
      setTrend("building")
      return
    }

    let cancelled = false
    setHistoryLoading(true)
    void fetch(`/api/card-deficit-history?id=${encodeURIComponent(selectedCard.id)}&grade=${salesGrade}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as DeficitHistoryResponse | null
        if (cancelled) return
        if (!res.ok || !data) {
          setHistory([])
          setTrend("building")
          return
        }
        setHistory(Array.isArray(data.history) ? data.history : [])
        setTrend(data.trend ?? "building")
      })
      .catch(() => {
        if (!cancelled) {
          setHistory([])
          setTrend("building")
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedCard, salesGrade])

  useEffect(() => {
    if (!selectedCard || selectedCard.hasPricing === false) return

    let cancelled = false
    setSalesLoading(true)
    void fetch(`/api/card-sales?id=${encodeURIComponent(selectedCard.id)}&grade=${salesGrade}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as CardSalesResponse | null
        if (cancelled) return
        if (!res.ok || !data) return
        setLiveRawSales(Array.isArray(data.recentRawSales) ? data.recentRawSales : [])
        setLiveSlabSales(Array.isArray(data.recentSlabSales) ? data.recentSlabSales : [])
      })
      .catch(() => {
        // Keep cached sales from the card entry
      })
      .finally(() => {
        if (!cancelled) setSalesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedCard, salesGrade])

  if (!selectedCard) return null

  const priced = selectedCard.hasPricing !== false
  const pricingLoading = selectedCard.marketInsight === "Loading PSA 7–10 comps…"
  const gradeQuotes = getGradeQuotes(selectedCard)
  const best = getBestGradeQuote(gradeQuotes)
  const activeQuote = gradeQuotes.find((q) => q.grade === salesGrade) ?? best
  const slabCard = mockEntryToSlabCard(selectedCard)
  const confidence = priced ? getConfidence(selectedCard, salesGrade) : null
  const handleCondition = (key: ConditionKey, value: number) =>
    setCondition((prev) => ({ ...prev, [key]: value }))

  const cachedSlabSales =
    activeQuote?.recentSlabSales ?? selectedCard.recentSlabSales ?? []
  const rawSales = liveRawSales ?? selectedCard.recentRawSales ?? []
  const slabSales = liveSlabSales ?? cachedSlabSales

  const trendLabel =
    trend === "widening"
      ? "Gap widening"
      : trend === "closing"
        ? "Gap closing"
        : trend === "building"
          ? "Building history"
          : "Holding steady"

  const confidenceColor: Record<string, string> = {
    high: "text-primary border-primary/30 bg-primary/10",
    medium: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    low: "text-destructive border-destructive/30 bg-destructive/10",
  }

  const ebayUrl = ebaySearchUrl(
    `${selectedCard.cardName} ${selectedCard.cardNumber} PSA ${salesGrade}`,
    `slabcrack-${selectedCard.id}-psa${salesGrade}`,
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${selectedCard.cardName} details`}
        className={cn(
          "relative flex max-h-[92vh] w-full max-w-lg animate-slide-up flex-col overflow-hidden rounded-t-3xl border border-border bg-popover",
          "sm:rounded-3xl",
        )}
      >
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

          {priced && (
            <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="font-semibold text-foreground">Most recent eBay sold</h4>
                {salesLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              </div>
              <div className="flex flex-col gap-2">
                <RecentSalesList
                  title="Raw NM"
                  sales={rawSales}
                  emptyMessage="No recent raw sold comps in cache yet."
                />
                <RecentSalesList
                  title={`PSA ${salesGrade}`}
                  sales={slabSales}
                  emptyMessage={`No recent PSA ${salesGrade} sold comps yet.`}
                />
              </div>
            </div>
          )}

          {priced && confidence && (
            <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                <h4 className="font-semibold text-foreground">Deal Intelligence</h4>
              </div>

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
                    {historyLoading ? "Loading…" : trendLabel}
                  </span>
                  {trend === "building" && !historyLoading && (
                    <span className="mt-1 text-[11px] text-muted-foreground">
                      More daily syncs needed for a full trend.
                    </span>
                  )}
                </div>
                {history.length >= 2 ? (
                  <DeficitSparkline
                    data={history}
                    trend={trend === "building" ? "stable" : trend}
                  />
                ) : (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    {confidence.sales} sold comps (raw + PSA {salesGrade})
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card/60 p-3">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    PSA population
                  </span>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Official PSA pop reports are not available yet.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="mb-1.5 flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" />
              <h4 className="font-semibold text-foreground">Market Insights</h4>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{selectedCard.marketInsight}</p>
          </div>

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
