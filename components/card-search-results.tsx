"use client"

import { Loader2, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { CatalogCardTile } from "@/components/catalog-card-tile"
import type { CardSearchHit } from "@/lib/card-lookup"

export type { CardSearchHit }

export type CardSearchResultsProps = {
  hits: CardSearchHit[]
  loading: boolean
  pricing?: boolean
  query: string
  watchedIds: string[]
  isHitWatched: (hit: CardSearchHit) => boolean
  onSelect: (hit: CardSearchHit) => void
  onToggleWatch: (hit: CardSearchHit) => void
  detailLoadingId: string | null
}

export function CardSearchResults({
  hits,
  loading,
  pricing = false,
  query,
  isHitWatched,
  onSelect,
  onToggleWatch,
  detailLoadingId,
}: CardSearchResultsProps) {
  if (query.trim().length < 2) return null

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Catalog search
        </h2>
        {(loading || pricing) && <Loader2 className="size-3.5 animate-spin text-primary" />}
      </div>

      {loading && hits.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Searching Pokémon catalog…
        </p>
      ) : hits.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
          No cards found for &ldquo;{query}&rdquo;. Try a name, set (e.g. 151), or number (e.g. #173).
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {hits.map((hit) => {
            const watched = isHitWatched(hit)
            const loadingDetail = detailLoadingId === hit.id
            const hasPrice = hit.rawPrice != null && hit.rawPrice > 0

            return (
              <li key={hit.id}>
                <CatalogCardTile
                  cardId={hit.id}
                  cardName={hit.cardName}
                  setName={hit.setName}
                  cardNumber={hit.cardNumber}
                  imageUrl={hit.imageUrl}
                  rawPrice={hit.rawPrice ?? 0}
                  pricingPending={pricing && !hasPrice}
                  secondaryHint={
                    loadingDetail
                      ? "Loading comps…"
                      : hasPrice
                        ? undefined
                        : "Tap for slab comps"
                  }
                  onClick={() => onSelect(hit)}
                  disabled={loadingDetail}
                  topRight={
                    <button
                      type="button"
                      aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggleWatch(hit)
                      }}
                      className={cn(
                        "flex size-7 items-center justify-center rounded-lg border bg-background/90 transition-colors",
                        watched
                          ? "border-primary/50 bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Star className={cn("size-3.5", watched && "fill-current")} />
                    </button>
                  }
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
