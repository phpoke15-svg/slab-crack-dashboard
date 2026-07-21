"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, Camera, Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { CardScanner } from "@/components/card-scanner"
import { CardSearchResults } from "@/components/card-search-results"
import { CatalogCardTile } from "@/components/catalog-card-tile"
import { TcgResearchCardPanel } from "@/components/tcg-research-card-panel"
import type { CardSearchHit } from "@/lib/card-lookup"
import type { ScanPipelineResult } from "@/lib/scanner/types"
import type { TcgResearchCardFull } from "@/lib/tcg-research/card-full"
import { matchTcgResearchSnapshot } from "@/lib/tcg-research/vision-scan-client"
import type { TcgGame } from "@/lib/scrydex/types"

function scanResultFromTcgResearchPayload(payload: TcgResearchCardFull): ScanPipelineResult {
  const card = payload.card
  return {
    ok: true,
    detected: {
      cardName: card.cardName,
      setName: card.setName,
      cardNumber: card.cardNumber,
      confidence: 95,
    },
    query: `${card.cardName} ${card.cardNumber}`.trim(),
    hit: {
      id: card.id,
      pokemonTcgId: card.pokemonTcgId,
      cardName: card.cardName,
      setName: card.setName,
      cardNumber: card.cardNumber,
      imageUrl: card.imageUrl,
      rawPrice: card.rawPrice > 0 ? card.rawPrice : undefined,
    },
    candidates: [],
    card,
    source: "gemini",
    matchScore: 100,
    pricingSource: "local",
    needsLiveRefresh: false,
    matchMethod: "vision",
  }
}

const GAME_TABS: { id: TcgGame; label: string }[] = [
  { id: "pokemon", label: "Pokémon" },
  { id: "lorcana", label: "Lorcana" },
  { id: "mtg", label: "MTG" },
]

function useTcgResearchPopular(game: TcgGame) {
  const [hits, setHits] = useState<CardSearchHit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    void (async () => {
      try {
        const params = new URLSearchParams({ game, limit: "100" })
        const res = await fetch(`/api/tcg-research/popular?${params.toString()}`, {
          signal: controller.signal,
        })
        const json = (await res.json()) as { results?: CardSearchHit[]; error?: string }
        if (!res.ok) throw new Error(json.error || "Could not load popular cards")
        setHits(json.results ?? [])
      } catch (err) {
        if (controller.signal.aborted) return
        setHits([])
        setError(err instanceof Error ? err.message : "Could not load popular cards")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    })()

    return () => controller.abort()
  }, [game])

  return { hits, isLoading, error }
}

function TcgResearchBrowseList({
  title,
  hits,
  loading,
  emptyMessage,
  onSelect,
  detailLoadingId,
}: {
  title: string
  hits: CardSearchHit[]
  loading: boolean
  emptyMessage: string
  onSelect: (hit: CardSearchHit) => void
  detailLoadingId: string | null
}) {
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {loading ? <Loader2 className="size-3.5 animate-spin text-primary" /> : null}
      </div>

      {loading && hits.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Loading top cards…
        </p>
      ) : hits.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {hits.map((hit, index) => {
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
                  rawLabel="Market"
                  rank={index + 1}
                  secondaryHint={loadingDetail ? "Loading…" : hasPrice ? undefined : "Tap for details"}
                  onClick={() => onSelect(hit)}
                  disabled={loadingDetail}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function useTcgResearchSearch(query: string, game: TcgGame, enabled: boolean) {
  const [hits, setHits] = useState<CardSearchHit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || query.trim().length < 2) {
      setHits([])
      setError(null)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ q: query.trim(), game })
        const res = await fetch(`/api/tcg-research/search?${params.toString()}`, {
          signal: controller.signal,
        })
        const json = (await res.json()) as { results?: CardSearchHit[]; error?: string }
        if (!res.ok) throw new Error(json.error || "Search failed")
        setHits(json.results ?? [])
      } catch (err) {
        if (controller.signal.aborted) return
        setHits([])
        setError(err instanceof Error ? err.message : "Search failed")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [enabled, game, query])

  return { hits, isLoading, error }
}

export function TcgResearchClient() {
  const [game, setGame] = useState<TcgGame>("pokemon")
  const [query, setQuery] = useState("")
  const [selectedPayload, setSelectedPayload] = useState<TcgResearchCardFull | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const scanPayloadRef = useRef<TcgResearchCardFull | null>(null)

  const searchEnabled = query.trim().length >= 2
  const { hits, isLoading, error: searchError } = useTcgResearchSearch(query, game, searchEnabled)
  const {
    hits: popularHits,
    isLoading: popularLoading,
    error: popularError,
  } = useTcgResearchPopular(game)

  const gameLabel = GAME_TABS.find((tab) => tab.id === game)?.label ?? "TCG"

  const loadDetail = useCallback(async (hit: CardSearchHit) => {
    setDetailLoadingId(hit.id)
    setDetailError(null)
    try {
      const params = new URLSearchParams({ id: hit.id, game })
      const res = await fetch(`/api/tcg-research/card?${params.toString()}`)
      const json = (await res.json()) as TcgResearchCardFull & { error?: string }
      if (!res.ok || !json.card) throw new Error(json.error || "Could not load card")
      setSelectedPayload(json)
    } catch (error) {
      setSelectedPayload(null)
      setDetailError(error instanceof Error ? error.message : "Could not load card")
    } finally {
      setDetailLoadingId(null)
    }
  }, [game])

  const matchScrydexSnapshot = useCallback(
    async (snapshot: string) => {
      const outcome = await matchTcgResearchSnapshot(snapshot, game)
      if (!outcome.ok) return { ok: false as const, error: outcome.error }
      scanPayloadRef.current = outcome.payload
      return { ok: true as const, result: scanResultFromTcgResearchPayload(outcome.payload) }
    },
    [game],
  )

  const handleScanMatch = useCallback((_result: ScanPipelineResult, _snapshot: string) => {
    const payload = scanPayloadRef.current
    if (!payload) return
    setSelectedPayload(payload)
    setDetailError(null)
    if (payload.game !== game) setGame(payload.game)
    setScanOpen(false)
    scanPayloadRef.current = null
  }, [game])

  const handleScanFail = useCallback((error: string) => {
    setDetailError(error)
    setScanOpen(false)
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <CollecToolsBrand href="/" size="lg" subtitle="TCG Research · catalog + market analytics" />
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Unlimited hybrid search across Pokémon, Lorcana, and MTG with Scrydex prices,
            sold comps, price history, and Scrydex Vision scanning.
          </p>
        </div>
        <SiteAuthButton className="shrink-0" />
      </header>

      <section className="rounded-2xl border border-border bg-card/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border bg-secondary/40 p-0.5" role="tablist">
            {GAME_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={game === tab.id}
                onClick={() => {
                  setGame(tab.id)
                  setSelectedPayload(null)
                  setDetailError(null)
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                  game === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 sm:text-sm"
          >
            <Camera className="size-4" />
            Scan card
          </button>
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, set, or collector number…"
            className={cn(
              "h-11 w-full rounded-xl border border-border bg-secondary/60 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground",
              "outline-none transition-colors focus:border-primary/50 focus:bg-secondary",
            )}
          />
        </div>

        {searchError ? (
          <p className="mt-3 text-sm text-destructive">{searchError}</p>
        ) : null}

        {searchEnabled ? (
          <div className="mt-4">
            <CardSearchResults
              hits={hits}
              loading={isLoading}
              query={query}
              watchedIds={[]}
              isHitWatched={() => false}
              onSelect={(hit) => void loadDetail(hit)}
              onToggleWatch={() => {}}
              detailLoadingId={detailLoadingId}
            />
          </div>
        ) : (
          <TcgResearchBrowseList
            title={`Top 100 popular ${gameLabel} cards`}
            hits={popularHits}
            loading={popularLoading}
            emptyMessage={
              popularError ??
              "No popular cards indexed yet for this game. Try searching above or run Scrydex sync."
            }
            onSelect={(hit) => void loadDetail(hit)}
            detailLoadingId={detailLoadingId}
          />
        )}

        {detailError ? (
          <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {detailError}
          </p>
        ) : null}
      </section>

      {selectedPayload ? (
        <TcgResearchCardPanel
          payload={selectedPayload}
          onClose={() => {
            setSelectedPayload(null)
            setDetailError(null)
          }}
        />
      ) : null}

      {scanOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-3 p-4">
            <button
              type="button"
              onClick={() => setScanOpen(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/50 px-3 py-2 text-sm font-semibold text-white backdrop-blur"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <span className="rounded-full border border-white/20 bg-black/50 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">
              Scrydex Vision · {gameLabel}
            </span>
          </div>

          <CardScanner
            immersive
            className="min-h-0 flex-1"
            matchSnapshot={matchScrydexSnapshot}
            onMatch={handleScanMatch}
            onScanFail={handleScanFail}
          />
        </div>
      ) : null}

      <SiteFooter />
    </div>
  )
}
