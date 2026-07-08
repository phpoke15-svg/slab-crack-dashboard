"use client"

import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CardStatus, TcgCard } from "@/lib/trade-binder/cards"
import { binderCardKey } from "@/lib/trade-binder/binder"
import { FolderSwitcher } from "./folder-switcher"
import { CardImage } from "./card-image"

const rarityStyles: Record<TcgCard["rarity"], string> = {
  Common: "border-border bg-secondary/80 text-muted-foreground",
  Rare: "border-border bg-secondary text-foreground",
  Epic: "border-wishlist/40 bg-wishlist/15 text-wishlist",
  Legendary: "border-primary/40 bg-primary/15 text-primary",
}

export function CardTile({
  card,
  onSetStatus,
  onRemove,
  showRemove = false,
}: {
  card: TcgCard
  onSetStatus: (id: string, status: CardStatus) => void
  onRemove?: (id: string) => void
  showRemove?: boolean
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-[3/4] overflow-hidden border-b border-border bg-muted/40">
        <CardImage
          card={card}
          alt={`${card.name} trading card`}
        />
        <span
          className={cn(
            "absolute left-1.5 top-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm",
            rarityStyles[card.rarity],
          )}
        >
          {card.rarity}
        </span>
        {showRemove && onRemove && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onRemove(binderCardKey(card))
            }}
            aria-label={`Remove ${card.name} from binder`}
            className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-lg border border-border bg-background/90 text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold leading-tight text-foreground">{card.name}</h3>
          <p className="truncate text-[11px] text-muted-foreground">{card.set}</p>
          {card.rawPrice != null && card.rawPrice > 0 && (
            <p className="mt-0.5 font-mono text-[11px] font-medium text-primary tabular-nums">
              ${card.rawPrice >= 100 ? card.rawPrice.toFixed(0) : card.rawPrice.toFixed(2)}
            </p>
          )}
        </div>

        <FolderSwitcher
          status={card.status}
          onSelect={(status) => onSetStatus(card.id, status)}
        />
      </div>
    </article>
  )
}
