"use client"

import { Check } from "lucide-react"
import type { CardStatus, CatalogCard } from "@/lib/trade-binder/cards"
import { FolderSwitcher } from "./folder-switcher"
import { CardImage } from "./card-image"

export type SearchResultCard = CatalogCard & { rawPrice?: number; cardNumber?: string }

export function SearchResultTile({
  card,
  ownedStatus,
  pricePending = false,
  onAdd,
  onSetStatus,
}: {
  card: SearchResultCard
  ownedStatus?: CardStatus | null
  pricePending?: boolean
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
          {card.rawPrice != null && card.rawPrice > 0 ? (
            <p className="mt-0.5 font-mono text-[11px] font-medium text-primary tabular-nums">
              Raw ${card.rawPrice.toFixed(0)}
            </p>
          ) : pricePending ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">Pricing…</p>
          ) : null}
        </div>

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
