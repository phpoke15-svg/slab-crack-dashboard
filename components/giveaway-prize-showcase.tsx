"use client"

import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import { GIVEAWAY_PRIZE_PER_ACCOUNT_USD } from "@/lib/giveaway/constants"
import type { GiveawayPrizeCard, PrizeCardPriceBand } from "@/lib/giveaway/prize-cards"
import type { GiveawayPrizePayload } from "@/lib/giveaway/types"
import { cn } from "@/lib/utils"

type Props = {
  prize: GiveawayPrizePayload
  cards: GiveawayPrizeCard[]
  priceBand: PrizeCardPriceBand | null
}

function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function priceDeltaLabel(cardPrice: number, target: number): string {
  const diff = cardPrice - target
  if (Math.abs(diff) < 0.01) return "Matches prize value"
  const prefix = diff > 0 ? "+" : "−"
  return `${prefix}${formatUsd(Math.abs(diff))} vs prize`
}

export function GiveawayPrizeShowcase({ prize, cards, priceBand }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)

  const goTo = useCallback(
    (index: number) => {
      if (!cards.length) return
      const wrapped = ((index % cards.length) + cards.length) % cards.length
      setActiveIndex(wrapped)
    },
    [cards.length],
  )

  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo])
  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo])

  useEffect(() => {
    setActiveIndex(0)
  }, [prize.prizeArvUsd, cards.length])

  useEffect(() => {
    if (!cards.length) return
    const timer = window.setInterval(() => goTo(activeIndex + 1), 8000)
    return () => window.clearInterval(timer)
  }, [activeIndex, cards.length, goTo])

  const activeCard = cards[activeIndex]
  const snapshotLabel = prize.snapshotDate ?? prize.monthPeriod

  return (
    <section className="mb-6 space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="mb-3 flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Today&apos;s giveaway prize value</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Running total as of {snapshotLabel}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Registered accounts</p>
            <p className="text-2xl font-bold">{prize.accountSnapshot.toLocaleString("en-US")}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Prize ARV</p>
            <p className="text-2xl font-bold text-primary">{formatUsd(prize.prizeArvUsd)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {prize.accountSnapshot.toLocaleString("en-US")} × {formatUsd(GIVEAWAY_PRIZE_PER_ACCOUNT_USD)} per account.
          The total on the last day of the month is the official prize value for that month&apos;s drawing.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h3 className="text-sm font-semibold">Top {cards.length || 10} cards within 5% of {formatUsd(prize.prizeArvUsd)}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Only cards priced within ±5% of today&apos;s giveaway value are shown
          {priceBand ? ` (${formatUsd(priceBand.min)}–${formatUsd(priceBand.max)})` : ""}
        </p>

        {cards.length && activeCard ? (
          <div className="mt-4 space-y-3">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-background">
              <div className="grid grid-cols-[auto_1fr] gap-4 p-4">
                <div className="relative h-44 w-32 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-52 sm:w-36">
                  <Image
                    src={activeCard.image || "/placeholder.svg"}
                    alt={activeCard.name}
                    fill
                    className="object-cover"
                    sizes="144px"
                    unoptimized
                  />
                </div>

                <div className="flex min-w-0 flex-col justify-between py-0.5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      #{activeIndex + 1} of {cards.length}
                    </p>
                    <h4 className="mt-1 line-clamp-2 text-base font-semibold leading-tight text-foreground">
                      {activeCard.name}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {activeCard.set}
                      {activeCard.cardNumber ? ` · ${activeCard.cardNumber}` : ""}
                    </p>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-2xl font-bold text-primary">{formatUsd(activeCard.rawPrice)}</p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Raw NM
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Prize target {formatUsd(prize.prizeArvUsd)} ·{" "}
                      {priceDeltaLabel(activeCard.rawPrice, prize.prizeArvUsd)}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous card"
                className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-sm transition hover:bg-muted"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next card"
                className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-sm transition hover:bg-muted"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5">
              {cards.map((card, index) => (
                <button
                  key={card.id}
                  type="button"
                  aria-label={`Show ${card.name}`}
                  onClick={() => goTo(index)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    index === activeIndex
                      ? "w-5 bg-primary"
                      : "w-1.5 bg-muted-foreground/35 hover:bg-muted-foreground/55",
                  )}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            No priced catalog cards within ±5% of today&apos;s prize value yet — the prize total above still
            updates daily. Examples appear when catalog prices align with the running giveaway ARV.
          </p>
        )}
      </div>
    </section>
  )
}
