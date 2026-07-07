"use client"

import Image from "next/image"
import { ArrowLeftRight, Check, Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CardStatus, CatalogCard, Rarity } from "@/lib/trade-binder/cards"

const rarityStyles: Record<Rarity, string> = {
  Common: "border-border bg-secondary text-muted-foreground",
  Rare: "border-chart-4/60 bg-chart-4/20 text-foreground",
  Epic: "border-wishlist/60 bg-wishlist/20 text-wishlist",
  Legendary: "border-primary/60 bg-primary/20 text-primary",
}

export function SearchResultTile({
  card,
  owned,
  onAdd,
}: {
  card: CatalogCard
  owned: boolean
  onAdd: (status: CardStatus) => void
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-[10px] border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)]">
      <div className="relative aspect-[3/4] overflow-hidden border-b-2 border-border bg-muted">
        <Image
          src={card.image || "/placeholder.svg"}
          alt={`${card.name} Pokemon card`}
          fill
          sizes="(max-width: 640px) 50vw, 200px"
          className="object-contain p-1 transition-transform duration-300 group-active:scale-[1.02]"
        />
        <span
          className={cn(
            "absolute left-1.5 top-1.5 rounded-xs border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm",
            rarityStyles[card.rarity],
          )}
        >
          {card.rarity}
        </span>
        {owned && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-xs border border-trade/70 bg-trade px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-trade-foreground">
            <Check className="size-3" aria-hidden="true" />
            Owned
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-2.5">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-base font-bold uppercase leading-tight tracking-wide text-card-foreground">
            {card.name}
          </h3>
          <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{card.set}</p>
        </div>

        {owned ? (
          <p className="mt-auto py-2 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            In your binder
          </p>
        ) : (
          <div className="mt-auto grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => onAdd("trade")}
              className="inline-flex items-center justify-center gap-1 rounded-xs border-2 border-trade/70 bg-trade px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-trade-foreground transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeftRight className="size-3" aria-hidden="true" />
              Add to Binder
            </button>
            <button
              type="button"
              onClick={() => onAdd("wishlist")}
              className="inline-flex items-center justify-center gap-1 rounded-xs border-2 border-wishlist/70 bg-wishlist px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-wishlist-foreground transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Heart className="size-3 fill-current" aria-hidden="true" />
              Add to Wishlist
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
