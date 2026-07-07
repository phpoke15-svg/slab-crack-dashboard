"use client"

import Image from "next/image"
import { ArrowLeftRight, Check, Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CardStatus, CatalogCard, Rarity } from "@/lib/trade-binder/cards"

export type SearchResultCard = CatalogCard & { rawPrice?: number }

const rarityStyles: Record<Rarity, string> = {
  Common: "border-border bg-secondary/80 text-muted-foreground",
  Rare: "border-border bg-secondary text-foreground",
  Epic: "border-wishlist/40 bg-wishlist/15 text-wishlist",
  Legendary: "border-primary/40 bg-primary/15 text-primary",
}

export function SearchResultTile({
  card,
  owned,
  onAdd,
}: {
  card: SearchResultCard
  owned: boolean
  onAdd: (status: CardStatus) => void
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-[3/4] overflow-hidden border-b border-border bg-muted/40">
        <Image
          src={card.image || "/placeholder.svg"}
          alt={`${card.name} Pokémon card`}
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
        {owned && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md border border-trade/50 bg-trade/20 px-1.5 py-0.5 text-[10px] font-medium text-trade">
            <Check className="size-3" aria-hidden="true" />
            Owned
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

        {owned ? (
          <p className="mt-auto py-2 text-center text-[11px] text-muted-foreground">Already in your binder</p>
        ) : (
          <div className="mt-auto grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => onAdd("trade")}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-trade/20 px-2 py-2 text-xs font-medium text-trade transition-colors hover:bg-trade/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeftRight className="size-3" aria-hidden="true" />
              Add for trade
            </button>
            <button
              type="button"
              onClick={() => onAdd("wishlist")}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-wishlist/20 px-2 py-2 text-xs font-medium text-wishlist transition-colors hover:bg-wishlist/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Heart className="size-3 fill-current" aria-hidden="true" />
              Add to wishlist
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
