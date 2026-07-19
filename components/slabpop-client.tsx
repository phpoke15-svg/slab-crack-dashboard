"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CardMarketFilterPanel } from "@/components/card-filters/card-market-filter-panel"
import { CardImage } from "@/components/trade-binder/binder/card-image"
import type { MockGradedCard } from "@/lib/card-filters/types"
import { SLABLABS_HREF } from "@/lib/slabs-labs-routes"
import { cn } from "@/lib/utils"

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`
}

export function SlabPopClient() {
  const [matches, setMatches] = useState<MockGradedCard[]>([])
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
        onViewResults={(cards, _filters) => {
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
            {matches.map((card) => (
              <li
                key={card.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3",
                )}
              >
                <CardImage
                  src={card.image}
                  alt=""
                  className="size-14 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{card.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {card.grade} · Pop {card.popCount.toLocaleString("en-US")}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm font-semibold text-primary tabular-nums">
                  {formatUsd(card.price)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
