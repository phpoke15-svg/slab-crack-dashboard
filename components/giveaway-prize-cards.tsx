"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { GIVEAWAY_PRIZE_PER_ACCOUNT_USD } from "@/lib/giveaway/constants"

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

export function GiveawayPrizeCards() {
  const [prize, setPrize] = useState<PrizeInfo | null>(null)
  const [cards, setCards] = useState<PrizeCard[]>([])
  const [band, setBand] = useState<PriceBand | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <section className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="mb-3 flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <div>
          <h2 className="text-sm font-semibold">What {formatUsd(prize.prizeArvUsd)} could buy</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Based on today&apos;s running giveaway value
            {prize.snapshotDate ? ` (${prize.snapshotDate})` : ""}:{" "}
            {prize.accountSnapshot.toLocaleString("en-US")} accounts ×{" "}
            {formatUsd(GIVEAWAY_PRIZE_PER_ACCOUNT_USD)}. Cards shown are near that price
            {band ? ` (${formatUsd(band.min)}–${formatUsd(band.max)})` : ""}.
          </p>
        </div>
      </div>

      {cards.length ? (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {cards.map((card) => (
            <article
              key={card.id}
              className="w-28 shrink-0 rounded-xl border border-border bg-background p-2"
            >
              <div className="relative mb-2 aspect-[5/7] overflow-hidden rounded-lg bg-muted">
                <Image
                  src={card.image || "/placeholder.svg"}
                  alt={card.name}
                  fill
                  className="object-cover"
                  sizes="112px"
                  unoptimized
                />
              </div>
              <p className="line-clamp-2 text-[11px] font-medium leading-tight text-foreground">
                {card.name}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{card.set}</p>
              <p className="mt-1 text-xs font-semibold text-primary">{formatUsd(card.rawPrice)}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No catalog matches in this price range yet — check back after the next price sync.
        </p>
      )}
    </section>
  )
}
