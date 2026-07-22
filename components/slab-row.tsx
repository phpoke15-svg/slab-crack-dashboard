"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Sparkles, ExternalLink } from "lucide-react"
import { SaveForLaterButton } from "@/components/save-for-later/save-for-later-button"
import { cn } from "@/lib/utils"
import { SelectedGradePriceCompact } from "@/components/grading/selected-grade-price"
import { SlabGradeSelector } from "@/components/grading/slab-grade-selector"
import {
  buildSlabQuotesForCompany,
  getBestSlabQuote,
  pickGradedPrice,
  resolveGradedPricesForCard,
  resolveSelectedGradeDisplayPrice,
} from "@/lib/grading/quotes"
import { useScrydexCardPricing } from "@/lib/grading/use-scrydex-card-pricing"
import {
  DEFAULT_SLAB_GRADE,
  coerceSlabGradeRef,
  formatSlabLabel,
  historyChartGradeProps,
  type SlabGradeRef,
} from "@/lib/grading/types"
import { slabEbayGradedAffiliateCampaign, slabEbayGradedSearchKeyword } from "@/lib/grading/ebay-search"
import { DeficitBadge } from "@/components/deficit-badge"
import { SlabCardImage } from "@/components/slab-card-image"
import { PriceHistoryChart } from "@/components/PriceHistoryChart"
import { PriceHistoryChart as LegacyPriceHistoryChart } from "@/components/price-history-chart"
import { ebaySearchUrl } from "@/lib/ebay-affiliate"
import type { MockCardEntry } from "@/lib/slab-data"

interface SlabRowProps {
  card: MockCardEntry
  onClick: () => void
  watched: boolean
  saved?: boolean
  onToggleSave?: () => void
}

export function SlabRow({ card, onClick, watched, saved = false, onToggleSave }: SlabRowProps) {
  const priced = card.hasPricing !== false
  const rowRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true)
      },
      { rootMargin: "160px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scrydexPricing = useScrydexCardPricing(card.id, visible)
  const gradedPrices = useMemo(
    () => resolveGradedPricesForCard(scrydexPricing.gradedPrices, card),
    [scrydexPricing.gradedPrices, card],
  )
  const [slabGrade, setSlabGrade] = useState<SlabGradeRef>(DEFAULT_SLAB_GRADE)
  const [selectedGrade, setSelectedGrade] = useState<SlabGradeRef | null>(null)

  useEffect(() => {
    const quotes = buildSlabQuotesForCompany(card.rawPrice, gradedPrices, "PSA").filter(
      (quote) => quote.grade !== "10",
    )
    const best = getBestSlabQuote(quotes)
    setSlabGrade(coerceSlabGradeRef("PSA", best?.grade ?? "9", gradedPrices))
    setSelectedGrade(null)
  }, [card.id, card.rawPrice, gradedPrices])

  const activeGrade = selectedGrade ?? slabGrade
  const companyQuotes = buildSlabQuotesForCompany(card.rawPrice, gradedPrices, activeGrade.company)
  const activeQuote =
    companyQuotes.find(
      (quote) => quote.company === activeGrade.company && quote.grade === activeGrade.grade,
    ) ?? getBestSlabQuote(companyQuotes)
  const selectedGradePrice = resolveSelectedGradeDisplayPrice(scrydexPricing.gradedPrices, card, activeGrade)
  const activeSlabPrice =
    activeQuote?.slabPrice ?? pickGradedPrice(gradedPrices, activeGrade) ?? selectedGradePrice.price ?? 0

  const ebayUrl = ebaySearchUrl(
    slabEbayGradedSearchKeyword(card.cardName, card.cardNumber, card.setName),
    slabEbayGradedAffiliateCampaign(card.id, "slabcrack"),
  )

  const chartGradeProps = historyChartGradeProps(activeGrade)
  const historyQuery = {
    catalogId: scrydexPricing.catalogId ?? undefined,
    scrydexId: scrydexPricing.scrydexId ?? undefined,
    game: scrydexPricing.game,
    company: activeGrade.company,
    grade: activeGrade.grade,
  }
  const showPriceHistory = priced && (card.rawPrice > 0 || gradedPrices.some((row) => row.marketPrice > 0))

  return (
    <div
      ref={rowRef}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        "group flex w-full cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-all sm:p-4",
        "hover:border-primary/40 hover:bg-card/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/60",
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 sm:w-16">
          <SlabCardImage
            card={card}
            alt={`${card.cardName} card artwork`}
            sizes="(max-width: 640px) 64px, 80px"
            className="object-contain p-0.5 transition-transform duration-300 group-hover:scale-105"
          />
          {watched && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-2.5" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold text-foreground">{card.cardName}</h3>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{card.cardNumber}</span>
              </div>
              <p className="truncate text-sm text-muted-foreground">{card.setName}</p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {onToggleSave ? (
                <SaveForLaterButton saved={saved} onToggle={onToggleSave} compact />
              ) : null}
              {priced && activeQuote?.isArbitrage ? (
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {formatSlabLabel(activeGrade)}
                  </span>
                  <DeficitBadge
                    diff={-activeQuote.deficit}
                    pct={-activeQuote.percentageSavings}
                    size="lg"
                  />
                </div>
              ) : priced && activeSlabPrice > 0 ? (
                <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-right">
                  <span className="block text-[11px] font-semibold text-muted-foreground">
                    {formatSlabLabel(activeGrade)}
                  </span>
                  <span className="font-mono text-xs font-semibold text-muted-foreground">No arbitrage</span>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-right">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {priced ? "No arbitrage" : "Awaiting sync"}
                  </span>
                </div>
              )}
              <a
                href={ebayUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-1 font-mono text-[10px] font-semibold text-muted-foreground transition-colors",
                  "hover:border-primary/40 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                )}
              >
                <ExternalLink className="size-3" />
                eBay
              </a>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Raw NM</span>
            <span
              className={cn(
                "font-mono text-base font-semibold tabular-nums",
                card.rawPrice > 0 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {card.rawPrice > 0 ? `$${card.rawPrice.toFixed(0)}` : "—"}
            </span>
            <SelectedGradePriceCompact
              slabGrade={activeGrade}
              gradedPrices={gradedPrices}
              card={card}
              priced={priced}
              loading={scrydexPricing.loading}
            />
            <SlabGradeSelector
              value={activeGrade}
              onChange={(value) => {
                setSlabGrade(value)
                setSelectedGrade(value)
              }}
              available={gradedPrices}
              compact
              className="ml-auto"
            />
          </div>
        </div>
      </div>

      {showPriceHistory ? (
        scrydexPricing.scrydexId ? (
          <PriceHistoryChart
            scrydexId={scrydexPricing.scrydexId}
            game={scrydexPricing.game}
            mode="graded"
            className="border-0 bg-transparent p-0 backdrop-blur-none"
          />
        ) : (
          <LegacyPriceHistoryChart
            cardId={scrydexPricing.catalogId ?? card.id}
            {...chartGradeProps}
            currentRaw={card.rawPrice}
            currentSlab={activeSlabPrice}
            historyQuery={historyQuery}
            compact
            subtitle="Scrydex"
          />
        )
      ) : null}
    </div>
  )
}
