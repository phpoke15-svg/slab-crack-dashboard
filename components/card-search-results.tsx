"use client"

import { Loader2, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { SlabCardImage } from "@/components/slab-card-image"
export type CardSearchHit = {
  id: string
  pokemonTcgId: string
  cardName: string
  setName: string
  cardNumber: string
  imageUrl: string
  rarity: string | null
}

export type CardSearchResultsProps = {
  hits: CardSearchHit[]
  loading: boolean
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
  query,
  watchedIds,
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
        {loading && <Loader2 className="size-3.5 animate-spin text-primary" />}
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
        <ul className="flex flex-col gap-2">
          {hits.map((hit) => {
            const watched = isHitWatched(hit)
            const loadingDetail = detailLoadingId === hit.id

            return (
              <li
                key={hit.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-2.5"
              >
                <button
                  type="button"
                  onClick={() => onSelect(hit)}
                  disabled={loadingDetail}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="relative aspect-[3/4] w-11 shrink-0 overflow-hidden rounded-md border border-white/10">
                    <SlabCardImage
                      card={{
                        id: hit.id,
                        cardName: hit.cardName,
                        setName: hit.setName,
                        imageUrl: hit.imageUrl,
                        cardNumber: hit.cardNumber,
                      }}
                      alt=""
                      sizes="44px"
                      className="object-contain p-0.5"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{hit.cardName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {hit.setName}
                      {hit.cardNumber ? ` · ${hit.cardNumber}` : ""}
                    </p>
                    <p className="mt-0.5 text-[10px] text-primary">
                      {loadingDetail ? "Loading PSA 7–10…" : "Tap for slab comps"}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
                  onClick={() => onToggleWatch(hit)}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                    watched
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Star className={cn("size-4", watched && "fill-current")} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
