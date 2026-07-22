"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { CardMarketFilterPanel } from "@/components/card-filters/card-market-filter-panel"
import { CardImage } from "@/components/trade-binder/binder/card-image"
import type { SlabPopCard } from "@/lib/card-filters/types"
import { SLABLABS_HREF } from "@/lib/slabs-labs-routes"
import { cn } from "@/lib/utils"

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`
}

function popLabel(card: SlabPopCard): string {
  const count = card.popCount.toLocaleString("en-US")
  if (card.popSource === "scrydex_pop") return `Registry pop ${count}`
  if (card.popSource === "sold_comps") return `Sold comps ${count}`
  if (card.popSource === "market_activity") return `Market activity ${count}`
  return `Pop ${count}`
}

function tcgResearchHref(card: SlabPopCard): string | null {
  if (!card.cardId || card.cardId.startsWith("demo-")) return null
  const params = new URLSearchParams({ id: card.cardId, game: "pokemon" })
  return `/tcg-research?${params.toString()}`
}

type SlabPopClientProps = {
  catalog: SlabPopCard[]
}

export function SlabPopClient({ catalog }: SlabPopClientProps) {
  const [matches, setMatches] = useState<SlabPopCard[]>([])
  const [showResults, setShowResults] = useState(false)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link
        href={SLABLABS_HREF}
        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All SlabLabs tools
      </Link>

      <CardMarketFilterPanel
        catalog={catalog}
        onViewResults={(cards) => {
          setMatches(cards)
          setShowResults(true)
        }}
      />

      {showResults ? (
        <section aria-label="Matching cards" className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {matches.length} matching card{matches.length === 1 ? "" : "s"}
          </h2>
          <ul className="grid gap-2">
            {matches.map((card) => {
              const researchHref = tcgResearchHref(card)
              return (
                <li
                  key={card.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3",
                  )}
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
                    <CardImage
                      card={{
                        id: card.cardId,
                        name: card.title.split(" · ")[0] ?? card.title,
                        set: card.setName ?? "",
                        image: card.image,
                        cardNumber: card.cardNumber,
                      }}
                      alt=""
                      sizes="56px"
                      className="object-cover"
                      upgrade={false}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{card.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {card.grade} · {popLabel(card)}
                    </p>
                    {researchHref ? (
                      <Link
                        href={researchHref}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        Open in TCG Research
                        <ExternalLink className="size-3" />
                      </Link>
                    ) : null}
                  </div>
                  <p className="shrink-0 font-mono text-sm font-semibold text-primary tabular-nums">
                    {formatUsd(card.price)}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
