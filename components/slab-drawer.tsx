"use client"

import { useEffect, useMemo, useState } from "react"
import {
  X,
  ExternalLink,
  Star,
  Lightbulb,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CompanyGradePriceGrid } from "@/components/grading/company-grade-price-grid"
import { SlabGradeSelector } from "@/components/grading/slab-grade-selector"
import {
  buildSlabQuotesForCompany,
  getBestSlabQuote,
  pickGradedPrice,
  resolveGradedPricesForCard,
  type ScrydexGradedPrice,
} from "@/lib/grading/quotes"
import {
  DEFAULT_SLAB_GRADE,
  formatSlabLabel,
  historyChartGradeProps,
  type SlabGradeRef,
} from "@/lib/grading/types"
import { slabEbayAffiliateCampaign, slabEbaySearchKeyword } from "@/lib/grading/ebay-search"
import { DEFAULT_PSA_GRADING_FEE } from "@/lib/psa-grading-tiers"
import { DeficitBadge } from "@/components/deficit-badge"
import { SlabCardImage } from "@/components/slab-card-image"
import { PriceHistoryChart } from "@/components/price-history-chart"
import { RecentSalesList } from "@/components/recent-sales-list"
import { ebaySearchUrl } from "@/lib/ebay-affiliate"
import { SaveForLaterButton } from "@/components/save-for-later/save-for-later-button"
import { resolvePsa10Price, type MockCardEntry, type RecentSale } from "@/lib/slab-data"

interface SlabDrawerProps {
  selectedCard: MockCardEntry | null
  watched: boolean
  saved?: boolean
  gradedPrices?: ScrydexGradedPrice[]
  onClose: () => void
  onToggleWatch: (card: MockCardEntry) => void
  onToggleSave?: (card: MockCardEntry) => void
  /**
   * Which tool metrics to emphasize.
   * `both` shows SlabCrack arbitrage + SlabLab PSA 10 ROI together (Scan default).
   */
  focus?: "slabcrack" | "slablab" | "both"
}

type CardSalesResponse = {
  recentRawSales?: RecentSale[]
  recentSlabSales?: RecentSale[]
  error?: string
}

export function SlabDrawer({
  selectedCard,
  watched,
  saved = false,
  gradedPrices: gradedPricesProp,
  onClose,
  onToggleWatch,
  onToggleSave,
  focus = "slabcrack",
}: SlabDrawerProps) {
  const [slabGrade, setSlabGrade] = useState<SlabGradeRef>(DEFAULT_SLAB_GRADE)
  const [liveRawSales, setLiveRawSales] = useState<RecentSale[] | null>(null)
  const [liveSlabSales, setLiveSlabSales] = useState<RecentSale[] | null>(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  const gradedPrices = useMemo(
    () => (selectedCard ? resolveGradedPricesForCard(gradedPricesProp, selectedCard) : []),
    [gradedPricesProp, selectedCard],
  )

  useEffect(() => {
    if (selectedCard) {
      setLiveRawSales(null)
      setLiveSlabSales(null)
      setFullscreen(false)
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
    setSlabGrade(DEFAULT_SLAB_GRADE)
  }, [selectedCard, gradedPrices])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (fullscreen) {
        setFullscreen(false)
        return
      }
      onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, fullscreen])

  useEffect(() => {
    if (!selectedCard || selectedCard.hasPricing === false) return

    let cancelled = false
    setSalesLoading(true)
    const params = new URLSearchParams({
      id: selectedCard.id,
      grade: slabGrade.grade,
      company: slabGrade.company,
    })
    void fetch(`/api/card-sales?${params.toString()}`)
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
  }, [selectedCard, slabGrade.company, slabGrade.grade])

  if (!selectedCard) return null

  const priced = selectedCard.hasPricing !== false
  const pricingLoading = selectedCard.marketInsight === "Loading PSA 7–10 comps…"
  const companyQuotes = buildSlabQuotesForCompany(selectedCard.rawPrice, gradedPrices, slabGrade.company)
  const activeQuote =
    companyQuotes.find(
      (quote) => quote.company === slabGrade.company && quote.grade === slabGrade.grade,
    ) ?? getBestSlabQuote(companyQuotes)
  const activeSlabPrice =
    activeQuote?.slabPrice ?? pickGradedPrice(gradedPrices, slabGrade) ?? 0

  const labPsa10 = resolvePsa10Price(selectedCard).price
  const labGross = labPsa10 - (selectedCard.rawPrice ?? 0)
  const labNet = labGross - DEFAULT_PSA_GRADING_FEE
  const labMult =
    selectedCard.rawPrice > 0 && labPsa10 > 0 ? labPsa10 / selectedCard.rawPrice : 0

  const rawSales = liveRawSales ?? selectedCard.recentRawSales ?? []
  const slabSales = liveSlabSales ?? selectedCard.recentSlabSales ?? []

  const ebayUrl = ebaySearchUrl(
    slabEbaySearchKeyword(
      selectedCard.cardName,
      selectedCard.cardNumber,
      slabGrade,
      selectedCard.setName,
    ),
    slabEbayAffiliateCampaign(selectedCard.id, slabGrade, "slabcrack"),
  )

  const chartGradeProps = historyChartGradeProps(slabGrade)

  const formatSigned = (n: number) => {
    if (!Number.isFinite(n)) return "—"
    const abs = Math.abs(n)
    const formatted = abs >= 100 ? abs.toFixed(0) : abs.toFixed(2)
    return `${n < 0 ? "-" : ""}$${formatted}`
  }

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
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-lg transition-opacity hover:opacity-90 sm:w-28"
              aria-label={`View ${selectedCard.cardName} full screen`}
            >
              <SlabCardImage
                card={selectedCard}
                alt={`${selectedCard.cardName} card artwork`}
                sizes="(max-width: 640px) 112px, 128px"
                className="object-contain p-1"
                upgrade
              />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-bold text-foreground">{selectedCard.cardName}</h2>
                <span className="shrink-0 font-mono text-sm text-muted-foreground">
                  {selectedCard.cardNumber}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{selectedCard.setName}</p>
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                className="mt-2 text-left text-[11px] font-medium text-primary hover:underline"
              >
                Tap card for full screen
              </button>
              <div className="mt-3 space-y-3">
                {pricingLoading ? (
                  <p className="text-sm text-muted-foreground">Loading PSA 7–10 comps…</p>
                ) : (
                  <>
                    {(focus === "slabcrack" || focus === "both") && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          SlabCrack · {formatSlabLabel(slabGrade)} vs raw NM
                        </span>
                        {priced && activeQuote?.isArbitrage ? (
                          <DeficitBadge
                            diff={-activeQuote.deficit}
                            pct={-activeQuote.percentageSavings}
                            size="lg"
                          />
                        ) : priced && activeQuote && activeSlabPrice > 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {formatSlabLabel(slabGrade)} slab is at or above raw — no arbitrage gap.
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Run sync-prices to load raw vs slab comps for this card.
                          </p>
                        )}
                      </div>
                    )}
                    {(focus === "slablab" || focus === "both") && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          SlabLab · PSA 10 vs raw NM
                        </span>
                        <p className="font-mono text-lg font-semibold text-foreground">
                          {labPsa10 > 0 ? `$${labPsa10.toFixed(2)}` : "—"}
                          <span className="ml-2 text-sm font-medium text-muted-foreground">
                            raw{" "}
                            {priced && selectedCard.rawPrice > 0
                              ? `$${selectedCard.rawPrice.toFixed(2)}`
                              : "—"}
                          </span>
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {(focus === "slablab" || focus === "both") && (
            <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-secondary/40 p-3">
              <div className="col-span-3 -mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                SlabLab · PSA 10 submission
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Gross</p>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground">{formatSigned(labGross)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Net ROI</p>
                <p
                  className={cn(
                    "mt-1 font-mono text-sm font-semibold",
                    labNet >= 0 ? "text-primary" : "text-amber-600",
                  )}
                >
                  {formatSigned(labNet)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mult</p>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                  {labMult > 0 ? `${labMult.toFixed(2)}×` : "—"}
                </p>
              </div>
              <p className="col-span-3 text-[10px] text-muted-foreground">
                Net uses PSA Regular grading fee (${DEFAULT_PSA_GRADING_FEE.toFixed(2)}).
              </p>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-3">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Raw NM</span>
                <span className="ml-2 font-mono text-lg font-semibold tabular-nums text-foreground">
                  {priced && selectedCard.rawPrice > 0 ? `$${selectedCard.rawPrice.toFixed(2)}` : "—"}
                </span>
              </div>
              <SlabGradeSelector
                value={slabGrade}
                onChange={setSlabGrade}
                available={gradedPrices}
                compact
              />
            </div>
            <CompanyGradePriceGrid
              company={slabGrade.company}
              gradedPrices={gradedPrices}
              rawPrice={selectedCard.rawPrice}
              priced={priced && !pricingLoading}
              selected={slabGrade}
            />
            {priced ? (
              <div className="mt-3">
                <PriceHistoryChart
                  cardId={selectedCard.id}
                  {...chartGradeProps}
                  currentRaw={selectedCard.rawPrice}
                  currentSlab={activeSlabPrice}
                />
              </div>
            ) : null}
          </div>

          <a
            href={ebayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ExternalLink className="size-4" />
            Search eBay {formatSlabLabel(slabGrade)}
          </a>

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
                  title={formatSlabLabel(slabGrade)}
                  sales={slabSales}
                  emptyMessage={`No recent ${formatSlabLabel(slabGrade)} sold comps yet.`}
                />
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

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => onToggleWatch(selectedCard)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium transition-colors",
                watched
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-secondary text-foreground hover:border-primary/40",
              )}
            >
              <Star className={cn("size-4", watched && "fill-primary")} />
              {watched ? "Watching" : "Add to Watchlist"}
            </button>
            {onToggleSave ? (
              <SaveForLaterButton
                saved={saved}
                onToggle={() => onToggleSave(selectedCard)}
                className="flex-1"
              />
            ) : null}
          </div>
        </div>
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/95 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedCard.cardName} full screen`}
        >
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{selectedCard.cardName}</p>
              <p className="truncate text-xs text-white/60">
                {selectedCard.setName} · #{selectedCard.cardNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Close full screen"
            >
              <X className="size-5" />
            </button>
          </div>
          <button
            type="button"
            className="flex min-h-0 flex-1 items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={() => setFullscreen(false)}
            aria-label="Close full screen card view"
          >
            <div className="relative aspect-[3/4] h-[min(85dvh,720px)] w-auto max-w-[min(100%,420px)]">
              <SlabCardImage
                card={selectedCard}
                alt={`${selectedCard.cardName} full screen`}
                sizes="100vw"
                className="object-contain"
                upgrade
              />
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
