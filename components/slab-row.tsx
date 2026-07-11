"use client"

import { useEffect, useState } from "react"
import { Sparkles, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getBestGradeQuote,
  getGradeQuotes,
  type MockCardEntry,
  type PsaGradeNumber,
} from "@/lib/slab-data"
import { GradePriceGrid } from "@/components/grade-price-grid"
import { DeficitBadge } from "@/components/deficit-badge"
import { SlabCardImage } from "@/components/slab-card-image"
import { ebaySearchUrl } from "@/lib/ebay-affiliate"

interface SlabRowProps {
  card: MockCardEntry
  onClick: () => void
  watched: boolean
}

export function SlabRow({ card, onClick, watched }: SlabRowProps) {
  const priced = card.hasPricing !== false
  const gradeQuotes = getGradeQuotes(card).filter((q) => q.grade !== 10)
  const best = getBestGradeQuote(gradeQuotes)
  const [selectedGrade, setSelectedGrade] = useState<PsaGradeNumber | null>(null)

  useEffect(() => {
    setSelectedGrade(null)
  }, [card.id])

  const activeGrade = selectedGrade ?? (best?.grade === 10 ? 9 : best?.grade) ?? 9
  const activeQuote = gradeQuotes.find((q) => q.grade === activeGrade) ?? best
  const ebayGrade = activeGrade
  const ebayUrl = ebaySearchUrl(
    `${card.cardName} ${card.cardNumber} PSA ${ebayGrade}`,
    `slabcrack-${card.id}-psa${ebayGrade}`,
  )

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
              {priced && activeQuote?.isArbitrage ? (
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground">PSA {activeGrade}</span>
                  <DeficitBadge diff={-activeQuote.deficit} pct={-activeQuote.percentageSavings} />
                </div>
              ) : priced && activeQuote && activeQuote.slabPrice > 0 ? (
                <div className="rounded-xl border border-border bg-secondary/40 px-3 py-1.5 text-right">
                  <span className="block text-[10px] font-medium text-muted-foreground">PSA {activeGrade}</span>
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

          <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Raw NM</span>
          <span
            className={cn(
              "font-mono text-sm font-medium tabular-nums",
              card.rawPrice > 0 ? "text-foreground/90" : "text-muted-foreground",
            )}
          >
            {card.rawPrice > 0 ? `$${card.rawPrice.toFixed(0)}` : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Slab comps</span>
        </div>
        </div>
      </div>

      <GradePriceGrid
        quotes={gradeQuotes}
        priced={priced || gradeQuotes.some((q) => q.slabPrice > 0)}
        compact
        selectedGrade={activeGrade}
        onSelectGrade={setSelectedGrade}
        highlightBest={selectedGrade == null}
      />
    </div>
  )
}
