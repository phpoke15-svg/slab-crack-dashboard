"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ExternalLink,
  Lightbulb,
  Loader2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CompanyGradePriceGrid } from "@/components/grading/company-grade-price-grid"
import { SlabGradeSelector } from "@/components/grading/slab-grade-selector"
import { PriceHistoryChart } from "@/components/price-history-chart"
import { RecentSalesList } from "@/components/recent-sales-list"
import { SlabCardImage } from "@/components/slab-card-image"
import { ebaySearchUrl } from "@/lib/ebay-affiliate"
import { slabEbayAffiliateCampaign, slabEbaySearchKeyword } from "@/lib/grading/ebay-search"
import {
  buildSlabQuotesForCompany,
  getBestSlabQuote,
  pickGradedPrice,
} from "@/lib/grading/quotes"
import {
  DEFAULT_SLAB_GRADE,
  formatSlabLabel,
  historyChartGradeProps,
  type SlabGradeRef,
} from "@/lib/grading/types"
import type { RecentSale } from "@/lib/slab-data"
import type { TcgResearchCardFull } from "@/lib/tcg-research/card-full"

type CardSalesResponse = {
  recentRawSales?: RecentSale[]
  recentSlabSales?: RecentSale[]
  error?: string
}

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "Unknown"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export function TcgResearchCardPanel({
  payload,
  onClose,
}: {
  payload: TcgResearchCardFull
  onClose: () => void
}) {
  const card = payload.card
  const gradedPrices = payload.gradedPrices
  const [slabGrade, setSlabGrade] = useState<SlabGradeRef>(DEFAULT_SLAB_GRADE)
  const [liveRawSales, setLiveRawSales] = useState<RecentSale[] | null>(null)
  const [liveSlabSales, setLiveSlabSales] = useState<RecentSale[] | null>(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError] = useState<string | null>(null)

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  useEffect(() => {
    setSlabGrade(DEFAULT_SLAB_GRADE)
    setLiveRawSales(null)
    setLiveSlabSales(null)
    setSalesError(null)
  }, [card.id, gradedPrices])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    setSalesLoading(true)
    setSalesError(null)

    const params = new URLSearchParams({
      id: card.id,
      grade: slabGrade.grade,
      company: slabGrade.company,
      game: payload.game,
    })
    if (payload.catalogId) params.set("catalogId", payload.catalogId)
    if (payload.scrydexId) params.set("scrydexId", payload.scrydexId)

    void fetch(`/api/tcg-research/sales?${params.toString()}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as CardSalesResponse | null
        if (cancelled) return
        if (!res.ok || !data) {
          setSalesError(data?.error ?? "Could not load sold comps")
          return
        }
        setLiveRawSales(Array.isArray(data.recentRawSales) ? data.recentRawSales : [])
        setLiveSlabSales(Array.isArray(data.recentSlabSales) ? data.recentSlabSales : [])
      })
      .catch(() => {
        if (!cancelled) setSalesError("Could not load sold comps")
      })
      .finally(() => {
        if (!cancelled) setSalesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [card.id, payload.catalogId, payload.game, payload.scrydexId, slabGrade.company, slabGrade.grade])

  const priced = card.hasPricing !== false
  const companyQuotes = useMemo(
    () => buildSlabQuotesForCompany(card.rawPrice, gradedPrices, slabGrade.company),
    [card.rawPrice, gradedPrices, slabGrade.company],
  )
  const activeQuote =
    companyQuotes.find(
      (quote) => quote.company === slabGrade.company && quote.grade === slabGrade.grade,
    ) ?? getBestSlabQuote(companyQuotes)
  const activeSlabPrice =
    activeQuote?.slabPrice ??
    pickGradedPrice(gradedPrices, slabGrade) ??
    0

  const chartGradeProps = historyChartGradeProps(slabGrade)

  const rawSales = liveRawSales ?? card.recentRawSales ?? []
  const slabSales = liveSlabSales ?? card.recentSlabSales ?? []

  const ebayUrl = ebaySearchUrl(
    slabEbaySearchKeyword(card.cardName, card.cardNumber, slabGrade, card.setName),
    slabEbayAffiliateCampaign(card.id, slabGrade, "tcg-research"),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close card details"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${card.cardName} research details`}
        className={cn(
          "relative flex max-h-[92vh] w-full max-w-2xl animate-slide-up flex-col overflow-hidden rounded-t-3xl border border-border bg-popover",
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

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="relative aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-muted/30 shadow-lg">
              <SlabCardImage card={card} alt={card.cardName} sizes="220px" className="object-contain p-2" />
            </div>
            <div className="mt-4 w-full min-w-0">
              <h2 className="text-xl font-bold text-foreground">{card.cardName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {card.setName} · #{card.cardNumber}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-border px-2 py-0.5 capitalize">{payload.game}</span>
                {payload.catalogId ? (
                  <span className="rounded-full border border-border px-2 py-0.5 font-mono">{payload.catalogId}</span>
                ) : null}
                {payload.priceSource ? (
                  <span className="rounded-full border border-border px-2 py-0.5">
                    Source: {payload.priceSource}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-3">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Raw NM</span>
                <span className="ml-2 font-mono text-lg font-semibold tabular-nums text-foreground">
                  {priced && card.rawPrice > 0 ? `$${card.rawPrice.toFixed(2)}` : "—"}
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
              rawPrice={card.rawPrice}
              priced={priced}
              selected={slabGrade}
            />
            {priced ? (
              <div className="mt-3">
                <PriceHistoryChart
                  cardId={payload.catalogId ?? card.id}
                  {...chartGradeProps}
                  currentRaw={card.rawPrice}
                  currentSlab={activeSlabPrice}
                  historyEndpoint="/api/tcg-research/price-history"
                  historyQuery={{
                    catalogId: payload.catalogId ?? undefined,
                    scrydexId: payload.scrydexId ?? undefined,
                    game: payload.game,
                    company: slabGrade.company,
                    grade: slabGrade.grade,
                  }}
                  title="Price history"
                  subtitle="Scrydex"
                />
              </div>
            ) : null}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Prices updated {formatUpdatedAt(payload.priceUpdatedAt)}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="font-semibold text-foreground">Recent sold comps</h4>
              {salesLoading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
            </div>
            {salesError ? <p className="mb-3 text-sm text-destructive">{salesError}</p> : null}
            <p className="mb-3 text-[11px] text-muted-foreground">
              Historical eBay sales via Scrydex listings
              {payload.scrydexId ? ` · ${payload.scrydexId}` : ""}
            </p>
            <div className="flex flex-col gap-2">
              <RecentSalesList
                title="Raw NM"
                sales={rawSales}
                emptyMessage="No recent raw sold comps found."
                defaultOpen
              />
              <RecentSalesList
                title={formatSlabLabel(slabGrade)}
                sales={slabSales}
                emptyMessage={`No recent ${formatSlabLabel(slabGrade)} sold comps found.`}
                defaultOpen
              />
            </div>
          </div>

          {payload.population.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
              <h4 className="font-semibold text-foreground">Population report</h4>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {payload.population.slice(0, 8).map((row) => (
                  <div
                    key={`${row.company}-${row.grade}`}
                    className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2"
                  >
                    <span className="text-sm text-foreground">
                      {row.company} {row.grade}
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="mb-1.5 flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" />
              <h4 className="font-semibold text-foreground">Market insight</h4>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{card.marketInsight}</p>
          </div>

          <a
            href={ebayUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ExternalLink className="size-4" />
            Search eBay {formatSlabLabel(slabGrade)}
          </a>
        </div>
      </div>
    </div>
  )
}
