"use client"

import Image from "next/image"
import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CardStatus, TcgCard } from "@/lib/trade-binder/cards"
import { FolderSwitcher } from "./folder-switcher"

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
        <Image
          src={card.image || "/placeholder.svg"}
          alt={`${card.name} trading card`}
          fill
          sizes="(max-width: 640px) 50vw, 200px"
          className="object-contain p-1 transition-transform duration-300 group-active:scale-[1.02]"
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
            onClick={() => onRemove(card.id)}
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
        </div>

        <FolderSwitcher
          status={card.status}
          onSelect={(status) => onSetStatus(card.id, status)}
        />
      </div>
    </article>
  )
}
