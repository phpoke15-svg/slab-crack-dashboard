"use client"

import Image from "next/image"
import { ArrowLeftRight, Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TcgCard } from "@/lib/trade-binder/cards"

const rarityStyles: Record<TcgCard["rarity"], string> = {
  Common: "border-border bg-secondary/80 text-muted-foreground",
  Rare: "border-border bg-secondary text-foreground",
  Epic: "border-wishlist/40 bg-wishlist/15 text-wishlist",
  Legendary: "border-primary/40 bg-primary/15 text-primary",
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
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold leading-tight text-foreground">{card.name}</h3>
          <p className="truncate text-[11px] text-muted-foreground">{card.set}</p>
        </div>

        <button
          type="button"
          onClick={() => onToggle(card.id)}
          aria-pressed={isTrade}
          aria-label={`${card.name} is ${isTrade ? "for trade" : "on your wishlist"}. Tap to toggle.`}
          className={cn(
            "mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isTrade
              ? "bg-trade/20 text-trade hover:bg-trade/30"
              : "bg-wishlist/20 text-wishlist hover:bg-wishlist/30",
          )}
        >
          {isTrade ? (
            <>
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
              For trade
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
