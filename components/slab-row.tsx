"use client"

import { useEffect, useMemo, useState } from "react"
import { Sparkles, ExternalLink } from "lucide-react"
import { SaveForLaterButton } from "@/components/save-for-later/save-for-later-button"
import { cn } from "@/lib/utils"
import { CompanyGradePriceGrid } from "@/components/grading/company-grade-price-grid"
import { SlabGradeSelector } from "@/components/grading/slab-grade-selector"
import {
  buildSlabQuotesForCompany,
  getBestSlabQuote,
  pickGradedPrice,
  resolveGradedPricesForCard,
} from "@/lib/grading/quotes"
import {
  DEFAULT_SLAB_GRADE,
  formatSlabLabel,
  historyChartGradeProps,
  type SlabGradeRef,
} from "@/lib/grading/types"
import { slabEbayAffiliateCampaign, slabEbaySearchKeyword } from "@/lib/grading/ebay-search"
import { DeficitBadge } from "@/components/deficit-badge"
import { SlabCardImage } from "@/components/slab-card-image"
import { PriceHistoryChart } from "@/components/price-history-chart"
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
  const gradedPrices = useMemo(() => resolveGradedPricesForCard(undefined, card), [card])
  const [slabGrade, setSlabGrade] = useState<SlabGradeRef>(DEFAULT_SLAB_GRADE)

  useEffect(() => {
    setSlabGrade(DEFAULT_SLAB_GRADE)
  }, [card.id, card.rawPrice, gradedPrices])

  const activeGrade = slabGrade
  const companyQuotes = buildSlabQuotesForCompany(card.rawPrice, gradedPrices, activeGrade.company)
  const activeQuote =
    companyQuotes.find(
      (quote) => quote.company === activeGrade.company && quote.grade === activeGrade.grade,
    ) ?? getBestSlabQuote(companyQuotes)
  const activeSlabPrice =
    activeQuote?.slabPrice ?? pickGradedPrice(gradedPrices, activeGrade) ?? 0

  const ebayUrl = ebaySearchUrl(
    slabEbaySearchKeyword(card.cardName, card.cardNumber, activeGrade, card.setName),
    slabEbayAffiliateCampaign(card.id, activeGrade, "slabcrack"),
  )

  const chartGradeProps = historyChartGradeProps(activeGrade)

  return (
    <div
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
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {formatSlabLabel(activeGrade)}
                  </span>
                  <DeficitBadge diff={-activeQuote.deficit} pct={-activeQuote.percentageSavings} />
                </div>
              ) : priced && activeSlabPrice > 0 ? (
                <div className="rounded-xl border border-border bg-secondary/40 px-3 py-1.5 text-right">
                  <span className="block text-[10px] font-medium text-muted-foreground">
                    {formatSlabLabel(activeGrade)}
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground">No arbitrage</span>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-secondary/40 px-3 py-1.5 text-right">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Raw NM</span>
            <span
              className={cn(
                "font-mono text-sm font-medium tabular-nums",
                card.rawPrice > 0 ? "text-foreground/90" : "text-muted-foreground",
              )}
            >
              {card.rawPrice > 0 ? `$${card.rawPrice.toFixed(0)}` : "—"}
            </span>
            <SlabGradeSelector
              value={activeGrade}
              onChange={setSlabGrade}
              available={gradedPrices}
              compact
              className="ml-auto"
            />
          </div>
        </div>
      </div>

      <CompanyGradePriceGrid
        company={activeGrade.company}
        gradedPrices={gradedPrices}
        rawPrice={card.rawPrice}
        priced={priced || companyQuotes.some((quote) => quote.slabPrice > 0)}
        compact
        selected={activeGrade}
      />

      {priced ? (
        <PriceHistoryChart
          cardId={card.id}
          {...chartGradeProps}
          currentRaw={card.rawPrice}
          currentSlab={activeSlabPrice}
          compact
        />
      ) : null}
    </div>
  )
}
