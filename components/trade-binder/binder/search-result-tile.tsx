"use client"

import { Check } from "lucide-react"
import type { CardStatus, CatalogCard } from "@/lib/trade-binder/cards"
import { AnimatedPrice } from "@/components/ui/micro-interactions"
import { FolderSwitcher } from "./folder-switcher"
import { CardImage } from "./card-image"

export type SearchResultCard = CatalogCard & { rawPrice?: number; cardNumber?: string }

export function SearchResultTile({
  card,
  ownedStatus,
  pricePending = false,
  onAdd,
  onSetStatus,
  onOpenDetail,
}: {
  card: SearchResultCard
  ownedStatus?: CardStatus | null
  pricePending?: boolean
  onAdd: (status: CardStatus) => void
  onSetStatus?: (status: CardStatus) => void
  onOpenDetail?: (card: SearchResultCard) => void
}) {
  const owned = ownedStatus != null

  return (
    <article className="group catalog-card-hover flex flex-col overflow-hidden rounded-xl border border-border bg-card hover:border-primary/40">
      <button
        type="button"
        onClick={() => onOpenDetail?.(card)}
        disabled={!onOpenDetail}
        className="relative aspect-[3/4] overflow-hidden border-b border-border bg-muted/40 text-left transition-colors hover:bg-muted/60 disabled:cursor-default"
      >
        <CardImage
          card={card}
          alt={`${card.name} Pokémon card`}
        />
        {owned && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <Check className="size-3" aria-hidden="true" />
            In binder
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2.5 p-2.5">
        <button
          type="button"
          onClick={() => onOpenDetail?.(card)}
          disabled={!onOpenDetail}
          className="min-w-0 text-left transition-colors hover:text-primary disabled:cursor-default"
        >
          <h3 className="truncate text-sm font-semibold leading-tight text-foreground">{card.name}</h3>
          <p className="truncate text-[11px] text-muted-foreground">{card.set}</p>
          {card.rawPrice != null && card.rawPrice > 0 ? (
            <p className="mt-0.5 font-mono text-[11px] font-medium tabular-nums">
              Raw{" "}
              <AnimatedPrice
                value={card.rawPrice}
                formatted={`$${card.rawPrice.toFixed(0)}`}
                className="text-primary"
              />
            </p>
          ) : pricePending ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">Pricing…</p>
          ) : (
            <p className="mt-0.5 text-[11px] text-muted-foreground">Tap for market data</p>
          )}
        </button>

        {owned && ownedStatus === "pending" ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-center text-[10px] font-medium text-amber-700 dark:text-amber-400">
            Locked in accepted trade
          </p>
        ) : owned && ownedStatus && onSetStatus ? (
          <FolderSwitcher status={ownedStatus} onSelect={onSetStatus} size="sm" />
        ) : (
          <FolderSwitcher status={null} onSelect={onAdd} size="sm" />
        )}
      </div>
    </article>
  )
}
