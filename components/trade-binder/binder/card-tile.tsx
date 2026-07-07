"use client"

import Image from "next/image"
import { ArrowLeftRight, Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TcgCard } from "@/lib/trade-binder/cards"

const rarityStyles: Record<TcgCard["rarity"], string> = {
  Common: "border-border bg-secondary text-muted-foreground",
  Rare: "border-chart-4/60 bg-chart-4/20 text-foreground",
  Epic: "border-wishlist/60 bg-wishlist/20 text-wishlist",
  Legendary: "border-primary/60 bg-primary/20 text-primary",
}

export function CardTile({
  card,
  onToggle,
}: {
  card: TcgCard
  onToggle: (id: string) => void
}) {
  const isTrade = card.status === "trade"

  return (
    <article className="group flex flex-col overflow-hidden rounded-[10px] border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)]">
      <div className="relative aspect-[3/4] overflow-hidden border-b-2 border-border bg-muted">
        <Image
          src={card.image || "/placeholder.svg"}
          alt={`${card.name} trading card`}
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
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-2.5">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-base font-bold uppercase leading-tight tracking-wide text-card-foreground">
            {card.name}
          </h3>
          <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{card.set}</p>
        </div>

        <button
          type="button"
          onClick={() => onToggle(card.id)}
          aria-pressed={isTrade}
          aria-label={`${card.name} is ${isTrade ? "for trade" : "on your wishlist"}. Tap to toggle.`}
          className={cn(
            "mt-auto inline-flex items-center justify-center gap-1.5 rounded-xs border-2 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
            isTrade
              ? "border-trade/70 bg-trade text-trade-foreground hover:brightness-110"
              : "border-wishlist/70 bg-wishlist text-wishlist-foreground hover:brightness-110",
          )}
        >
          {isTrade ? (
            <>
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
              For Trade
            </>
          ) : (
            <>
              <Heart className="size-3.5 fill-current" aria-hidden="true" />
              Wishlist
            </>
          )}
        </button>
      </div>
    </article>
  )
}
