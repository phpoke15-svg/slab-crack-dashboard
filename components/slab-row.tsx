"use client"

import { Sparkles } from "lucide-react"
import { SaveForLaterButton } from "@/components/save-for-later/save-for-later-button"
import { CatalogCardTile } from "@/components/catalog-card-tile"
import { DeficitBadge } from "@/components/deficit-badge"
import { pickGradedPrice, resolveGradedPricesForCard } from "@/lib/grading/quotes"
import { DEFAULT_SLAB_GRADE, formatSlabLabel } from "@/lib/grading/types"
import { resolvePsa10Price, type MockCardEntry } from "@/lib/slab-data"

interface SlabRowProps {
  card: MockCardEntry
  onClick: () => void
  watched: boolean
  saved?: boolean
  onToggleSave?: () => void
}

export function SlabRow({ card, onClick, watched, saved = false, onToggleSave }: SlabRowProps) {
  const priced = card.hasPricing !== false
  const gradedPrices = resolveGradedPricesForCard(undefined, card)
  const psa10 = resolvePsa10Price(card)
  const psa10Price = pickGradedPrice(gradedPrices, DEFAULT_SLAB_GRADE) || psa10.price
  const arbitrage =
    priced && card.rawPrice > 0 && psa10Price > card.rawPrice
      ? psa10Price - card.rawPrice
      : 0
  const arbitragePct = psa10Price > 0 ? (arbitrage / psa10Price) * 100 : 0

  return (
    <CatalogCardTile
      cardId={card.id}
      cardName={card.cardName}
      setName={card.setName}
      cardNumber={card.cardNumber}
      imageUrl={card.imageUrl}
      rawPrice={card.rawPrice}
      secondaryLabel={psa10.estimated ? "PSA 10 (est.)" : "PSA 10"}
      secondaryPrice={psa10Price}
      secondaryHint={
        priced && psa10Price <= 0
          ? "Tap for graded comps"
          : priced && arbitrage <= 0
            ? `${formatSlabLabel(DEFAULT_SLAB_GRADE)} · no gap`
            : undefined
      }
      priced={priced}
      onClick={onClick}
      badge={
        watched ? (
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-3" aria-hidden="true" />
          </span>
        ) : priced && arbitrage > 0 ? (
          <DeficitBadge diff={-arbitrage} pct={-arbitragePct} size="sm" />
        ) : null
      }
      topRight={
        onToggleSave ? (
          <div
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <SaveForLaterButton saved={saved} onToggle={onToggleSave} compact />
          </div>
        ) : null
      }
    />
  )
}
