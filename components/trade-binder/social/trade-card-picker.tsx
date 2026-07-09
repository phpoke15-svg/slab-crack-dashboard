"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import type { TcgCard } from "@/lib/trade-binder/cards"

type TradeCardPickerProps = {
  title: string
  subtitle?: string
  cards: TcgCard[]
  selectedIds: Set<string>
  onToggle: (card: TcgCard) => void
  variant: "offer" | "request"
  emptyLabel?: string
}

export function TradeCardPicker({
  title,
  subtitle,
  cards,
  selectedIds,
  onToggle,
  variant,
  emptyLabel = "No cards available",
}: TradeCardPickerProps) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="mb-2">
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            variant === "offer" ? "text-trade" : "text-wishlist",
          )}
        >
          {title}
        </p>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {cards.map((card) => {
            const selected = [...selectedIds].some((id) => cardMatchesId(card, id))
            return (
              <li key={card.clientKey}>
                <button
                  type="button"
                  onClick={() => onToggle(card)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
                    selected
                      ? variant === "offer"
                        ? "border-trade/50 bg-trade/10"
                        : "border-wishlist/50 bg-wishlist/10"
                      : "border-border bg-secondary/30 hover:border-primary/30",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {selected ? "✓" : ""}
                  </span>
                  <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-secondary">
                    <Image
                      src={card.image || "/placeholder.svg"}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="36px"
                    />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{card.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{card.set}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function cardsToDraft(cards: TcgCard[]) {
  return cards.map((c) => ({
    cardId: c.id,
    cardName: c.name,
    cardSet: c.set,
    cardImage: c.image,
  }))
}

export function toggleCardInSet(card: TcgCard, set: Set<string>): Set<string> {
  const next = new Set(set)
  if (next.has(card.id)) next.delete(card.id)
  else next.add(card.id)
  return next
}

export function cardMatchesId(card: TcgCard, id: string): boolean {
  return card.id === id || card.clientKey === id
}

export function selectedCards(cards: TcgCard[], selectedIds: Set<string>): TcgCard[] {
  return cards.filter((c) => [...selectedIds].some((id) => cardMatchesId(c, id)))
}
