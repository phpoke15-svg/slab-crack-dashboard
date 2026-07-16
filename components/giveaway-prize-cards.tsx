"use client"

import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react"
import { GIVEAWAY_PRIZE_PER_ACCOUNT_USD } from "@/lib/giveaway/constants"
import { cn } from "@/lib/utils"

type PrizeInfo = {
  monthPeriod: string
  snapshotDate?: string
  accountSnapshot: number
  prizeArvUsd: number
}

type PrizeCard = {
  id: string
  name: string
  set: string
  cardNumber?: string
  image: string
  rawPrice: number
}

type PriceBand = {
  min: number
  max: number
  target: number
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

export function GiveawayPrizeCards() {
  const [prize, setPrize] = useState<PrizeInfo | null>(null)
  const [cards, setCards] = useState<PrizeCard[]>([])
  const [band, setBand] = useState<PriceBand | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    fetch("/api/giveaway/prize-cards", { credentials: "same-origin" })
      .then((r) => r.json())
      .then(
        (json: {
          ok?: boolean
          prize?: PrizeInfo
          cards?: PrizeCard[]
          priceBand?: PriceBand
          error?: string
        }) => {
          if (!json.ok) {
            setError(json.error || "Could not load prize cards")
            return
          }
          if (json.prize) setPrize(json.prize)
          if (json.cards) setCards(json.cards)
          if (json.priceBand) setBand(json.priceBand)
        },
      )
      .catch(() => setError("Could not load prize cards"))
      .finally(() => setLoading(false))
  }, [])

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
    if (!cards.length) return
    const timer = window.setInterval(() => goTo(activeIndex + 1), 8000)
    return () => window.clearInterval(timer)
  }, [activeIndex, cards.length, goTo])

  if (loading) {
    return (
      <section className="mb-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading today&apos;s prize card examples…
        </div>
      </section>
    )
  }

  if (error || !prize) return null

  const activeCard = cards[activeIndex]

  return (
    <section className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="mb-4 flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <div>
          <h2 className="text-sm font-semibold">Top 10 cards near {formatUsd(prize.prizeArvUsd)}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Today&apos;s running giveaway value
            {prize.snapshotDate ? ` (${prize.snapshotDate})` : ""}:{" "}
            {prize.accountSnapshot.toLocaleString("en-US")} accounts ×{" "}
            {formatUsd(GIVEAWAY_PRIZE_PER_ACCOUNT_USD)}
            {band ? ` · catalog band ${formatUsd(band.min)}–${formatUsd(band.max)}` : ""}
          </p>
        </div>
      </div>

      {cards.length && activeCard ? (
        <div className="space-y-3">
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
                  <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-tight text-foreground">
                    {activeCard.name}
                  </h3>
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
                    Prize target {formatUsd(prize.prizeArvUsd)} · {priceDeltaLabel(activeCard.rawPrice, prize.prizeArvUsd)}
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
                  index === activeIndex ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/35 hover:bg-muted-foreground/55",
                )}
              />
            ))}
          </div>

          <p className="text-center text-[10px] text-muted-foreground">
            Swipe with arrows · auto-advances every 8s
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No catalog matches in this price range yet — check back after the next price sync.
        </p>
      )}
    </section>
  )
}
