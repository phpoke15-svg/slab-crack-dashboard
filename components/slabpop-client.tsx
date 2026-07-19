"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
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
  if (card.popSource === "sold_comps") return `Sold comps ${count}`
  if (card.popSource === "market_activity") return `Market activity ${count}`
  return `Pop ${count}`
}

type SlabPopClientProps = {
  catalog: SlabPopCard[]
  source: "live" | "demo"
}

export function SlabPopClient({ catalog, source }: SlabPopClientProps) {
  const [matches, setMatches] = useState<SlabPopCard[]>([])
  const [showResults, setShowResults] = useState(false)

  const catalogSummary = useMemo(() => {
    const psaRows = catalog.filter((card) => card.grade.startsWith("PSA"))
    return {
      total: catalog.length,
      psa: psaRows.length,
      withSoldComps: catalog.filter((card) => card.popSource === "sold_comps").length,
    }
  }, [catalog])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link
        href={SLABLABS_HREF}
        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All SlabLabs tools
      </Link>

      <p className="rounded-xl border border-border bg-card/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        {source === "live" ? (
          <>
            Live catalog: <span className="font-semibold text-foreground">{catalogSummary.psa}</span>{" "}
            PSA graded rows from PriceCharting cache
            {catalogSummary.withSoldComps > 0 ? (
              <>
                {" "}
                · <span className="font-semibold text-foreground">{catalogSummary.withSoldComps}</span>{" "}
                with SlabCrack sold-comp pop samples
              </>
            ) : null}
            . BGS/CGC filters apply to demo rows only until we add those graders.
          </>
        ) : (
          <>Demo catalog — connect Supabase + seed card_prices to load live graded prices.</>
        )}
      </p>

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
                    {card.grade} · {popLabel(card)}
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
