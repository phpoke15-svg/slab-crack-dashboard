"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, Camera, Clock3, Loader2, Search, TrendingUp } from "lucide-react"
import { CardScanner } from "@/components/card-scanner"
import { CardSearchResults } from "@/components/card-search-results"
import { CatalogCardTile } from "@/components/catalog-card-tile"
import { TabShellHeader } from "@/components/nav/tab-shell-header"
import { TcgResearchCardPanel } from "@/components/tcg-research-card-panel"
import {
  TCG_RESEARCH_GAME_TABS,
  useTcgResearchPopular,
  useTcgResearchSearch,
} from "@/components/tcg-research/tcg-research-hooks"
import type { CardSearchHit } from "@/lib/card-lookup"
import type { ScanPipelineResult } from "@/lib/scanner/types"
import type { TcgResearchCardFull } from "@/lib/tcg-research/card-full"
import { matchTcgResearchSnapshot } from "@/lib/tcg-research/vision-scan-client"
import { pushRecentSearch, readRecentSearches, type RecentSearchHit } from "@/lib/tcg-research/recent-searches"
import { fetchErrorMessage, readResponseJson } from "@/lib/fetch-json"
import type { TcgGame } from "@/lib/scrydex/types"
import { cn } from "@/lib/utils"

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

const QUICK_PILLS = [
  { id: "trending", label: "Trending Cards", action: "trending" as const },
  { id: "scan", label: "Scan Card", action: "scan" as const },
  { id: "tracker", label: "Set Price Tracker", action: "search" as const },
]

export function ResearchLandingClient() {
  const [game, setGame] = useState<TcgGame>("pokemon")
  const [query, setQuery] = useState("")
  const [selectedPayload, setSelectedPayload] = useState<TcgResearchCardFull | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [showTrending, setShowTrending] = useState(true)
  const [recentHits, setRecentHits] = useState<RecentSearchHit[]>([])
  const scanPayloadRef = useRef<TcgResearchCardFull | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const searchEnabled = query.trim().length >= 2
  const { hits, isLoading, error: searchError } = useTcgResearchSearch(query, game, searchEnabled)
  const {
    hits: popularHits,
    isLoading: popularLoading,
    error: popularError,
  } = useTcgResearchPopular(game)

  const gameLabel = TCG_RESEARCH_GAME_TABS.find((tab) => tab.id === game)?.label ?? "TCG"
  const trendingHits = popularHits.slice(0, 12)
  const recentForGame = recentHits.filter((hit) => hit.game === game).slice(0, 8)

  useEffect(() => {
    setRecentHits(readRecentSearches())
  }, [])

  const rememberHit = useCallback((hit: CardSearchHit, hitGame: TcgGame) => {
    pushRecentSearch(hit, hitGame)
    setRecentHits(readRecentSearches())
  }, [])

  const loadDetail = useCallback(async (hit: CardSearchHit, hitGame: TcgGame = game) => {
    setDetailLoadingId(hit.id)
    setDetailError(null)
    try {
      const params = new URLSearchParams({ id: hit.id, game: hitGame })
      const res = await fetch(`/api/tcg-research/card?${params.toString()}`)
      const json = await readResponseJson<TcgResearchCardFull & { error?: string }>(res)
      if (!json || !res.ok || !json.card) {
        throw new Error(fetchErrorMessage(res, json, "Could not load card"))
      }
      rememberHit(hit, hitGame)
      setSelectedPayload(json)
    } catch (error) {
      setSelectedPayload(null)
      setDetailError(error instanceof Error ? error.message : "Could not load card")
    } finally {
      setDetailLoadingId(null)
    }
  }, [game, rememberHit])

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
    const card = payload.card
    rememberHit(
      {
        id: card.id,
        pokemonTcgId: card.pokemonTcgId,
        cardName: card.cardName,
        setName: card.setName,
        cardNumber: card.cardNumber,
        imageUrl: card.imageUrl,
        rarity: null,
        rawPrice: card.rawPrice > 0 ? card.rawPrice : undefined,
      },
      payload.game,
    )
    setSelectedPayload(payload)
    setDetailError(null)
    if (payload.game !== game) setGame(payload.game)
    setScanOpen(false)
    scanPayloadRef.current = null
  }, [game, rememberHit])

  const handleScanFail = useCallback((error: string) => {
    setDetailError(error)
    setScanOpen(false)
  }, [])

  const handleQuickPill = (action: (typeof QUICK_PILLS)[number]["action"]) => {
    if (action === "scan") {
      setScanOpen(true)
      return
    }
    if (action === "search") {
      searchRef.current?.focus()
      return
    }
    setShowTrending(true)
    setQuery("")
  }

  return (
    <div className="app-tab-shell mx-auto flex w-full max-w-lg flex-col px-4 pt-5 pb-8 sm:px-5">
      <TabShellHeader title="TCG Research" subtitle="Search · charts · scan" />

      <section className="mt-6 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (e.target.value.trim().length >= 2) setShowTrending(false)
            }}
            placeholder="Search cards, sets, numbers…"
            className={cn(
              "h-14 w-full rounded-2xl border border-border bg-card/70 pl-12 pr-14 text-base text-foreground shadow-sm placeholder:text-muted-foreground",
              "outline-none transition-colors focus:border-primary/50 focus:bg-card",
            )}
          />
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            aria-label="Scan card with camera"
            className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-xl bg-primary/15 text-primary transition-colors hover:bg-primary/25"
          >
            <Camera className="size-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_PILLS.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => handleQuickPill(pill.action)}
              className="rounded-full border border-border bg-secondary/40 px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div className="flex rounded-xl border border-border bg-secondary/30 p-0.5" role="tablist">
          {TCG_RESEARCH_GAME_TABS.map((tab) => (
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
                "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
                game === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {searchError ? <p className="mt-4 text-sm text-destructive">{searchError}</p> : null}

      {searchEnabled ? (
        <div className="mt-5">
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
      ) : showTrending ? (
        <>
          {recentForGame.length > 0 ? (
            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Clock3 className="size-4 text-primary" />
                  Recent
                </h2>
              </div>
              <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
                <ul className="flex w-max gap-3">
                  {recentForGame.map((hit) => (
                    <li key={hit.id} className="w-[8.5rem] shrink-0">
                      <CatalogCardTile
                        cardId={hit.id}
                        cardName={hit.cardName}
                        setName={hit.setName}
                        cardNumber={hit.cardNumber}
                        imageUrl={hit.imageUrl}
                        rawPrice={hit.rawPrice ?? 0}
                        rawLabel="Market"
                        secondaryHint={detailLoadingId === hit.id ? "Loading…" : undefined}
                        onClick={() => void loadDetail(hit, hit.game)}
                        disabled={detailLoadingId === hit.id}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          <section className={cn("mt-6", recentForGame.length > 0 && "mt-8")}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <TrendingUp className="size-4 text-primary" />
              Trending {gameLabel}
            </h2>
            {popularLoading ? <Loader2 className="size-4 animate-spin text-primary" /> : null}
          </div>

          {popularLoading && trendingHits.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">
              Loading market movers…
            </p>
          ) : trendingHits.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">
              {popularError ?? "Search above to explore the catalog."}
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
              <ul className="flex w-max gap-3">
                {trendingHits.map((hit, index) => (
                  <li key={hit.id} className="w-[8.5rem] shrink-0">
                    <CatalogCardTile
                      cardId={hit.id}
                      cardName={hit.cardName}
                      setName={hit.setName}
                      cardNumber={hit.cardNumber}
                      imageUrl={hit.imageUrl}
                      rawPrice={hit.rawPrice ?? 0}
                      rawLabel="Market"
                      rank={index + 1}
                      secondaryHint={detailLoadingId === hit.id ? "Loading…" : undefined}
                      onClick={() => void loadDetail(hit)}
                      disabled={detailLoadingId === hit.id}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
        </>
      ) : null}

      {detailError ? (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {detailError}
        </p>
      ) : null}

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
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
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
    </div>
  )
}
