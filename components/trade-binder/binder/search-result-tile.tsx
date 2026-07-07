"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CardStatus, CatalogCard, Rarity } from "@/lib/trade-binder/cards"
import { FolderSwitcher } from "./folder-switcher"
import { CardImage } from "./card-image"

export type SearchResultCard = CatalogCard & { rawPrice?: number; cardNumber?: string }

const rarityStyles: Record<Rarity, string> = {
  Common: "border-border bg-secondary/80 text-muted-foreground",
  Rare: "border-border bg-secondary text-foreground",
  Epic: "border-wishlist/40 bg-wishlist/15 text-wishlist",
  Legendary: "border-primary/40 bg-primary/15 text-primary",
}

export function SearchResultTile({
  card,
  ownedStatus,
  onAdd,
  onSetStatus,
}: {
  card: SearchResultCard
  ownedStatus?: CardStatus | null
  onAdd: (status: CardStatus) => void
  onSetStatus?: (status: CardStatus) => void
}) {
  const owned = ownedStatus != null

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-[3/4] overflow-hidden border-b border-border bg-muted/40">
        <CardImage
          card={card}
          alt={`${card.name} Pokémon card`}
        />
        <span
          className={cn(
            "absolute left-1.5 top-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm",
            rarityStyles[card.rarity],
          )}
        >
          {card.rarity}
        </span>
        {owned && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <Check className="size-3" aria-hidden="true" />
            In binder
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold leading-tight text-foreground">{card.name}</h3>
          <p className="truncate text-[11px] text-muted-foreground">{card.set}</p>
          {card.rawPrice != null && card.rawPrice > 0 && (
            <p className="mt-0.5 font-mono text-[11px] font-medium text-primary tabular-nums">
              Raw ${card.rawPrice.toFixed(0)}
            </p>
          )}
        </div>

        {owned && ownedStatus && onSetStatus ? (
          <FolderSwitcher status={ownedStatus} onSelect={onSetStatus} size="sm" />
        ) : (
          <>
            <p className="text-[10px] text-muted-foreground">Add to folder:</p>
            <FolderSwitcher status={null} onSelect={onAdd} size="sm" />
          </>
        )}
      </div>
    </article>
  )
}
