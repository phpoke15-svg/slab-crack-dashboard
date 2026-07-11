"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Search,
  Zap,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Percent,
  ShoppingCart,
  Gem,
  BarChart3,
  Crown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import mockData from "@/lib/mockData.json"
import {
  FEEDS,
  normalizeCardEntry,
  type Feed,
  type MockCardEntry,
} from "@/lib/slab-data"
import { SlabRow } from "@/components/slab-row"
import { SlabDrawer } from "@/components/slab-drawer"
import { FeedAdSlot } from "@/components/feed-ad-slot"
import { AdSlot } from "@/components/ad-slot"
import { interleaveFeedAds } from "@/lib/feed-ads"
import { useOptionalEntitlements } from "@/components/billing/entitlements-provider"
import { CardSearchResults, type CardSearchHit } from "@/components/card-search-results"
import { searchHitToPlaceholder } from "@/lib/card-lookup"
import { FREE_SLABCRACK_LIMIT, pickMidDeficitCards } from "@/lib/slab-free-tier"
import Link from "next/link"
import {
  findWatchedIdForHit,
  isSearchHitWatched,
  loadWatchlistStore,
  resolveWatchedCards,
  saveWatchlistStore,
  toggleWatchlistCard,
  type WatchlistStore,
} from "@/lib/watchlist-storage"

const FALLBACK_FEED: MockCardEntry[] = []

const SLABCRACK_USES = [
  {
    title: "Buy, crack, and sell",
    body: "Spot slabs where cracking and selling raw beats the market price.",
    icon: ShoppingCart,
  },
  {
    title: "Buy high-end cards",
    body: "Find high-end cards under market for your personal collection.",
    icon: Gem,
  },
  {
    title: "Market awareness",
    body: "Track graded vs raw pricing gaps and stay ahead of the market.",
    icon: BarChart3,
  },
] as const

export function SlabDashboard() {
  const entitlements = useOptionalEntitlements()
  const [arbitrageFeed, setArbitrageFeed] = useState<MockCardEntry[]>(FALLBACK_FEED)
  const [feedLoading, setFeedLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [feed, setFeed] = useState<Feed>("top")
  const [selectedCard, setSelectedCard] = useState<MockCardEntry | null>(null)
  const [watchlistStore, setWatchlistStore] = useState<WatchlistStore>({
    ids: [],
    cards: {},
  })
  const [sortMode, setSortMode] = useState<"dollar" | "percent">("dollar")
  const [searchHits, setSearchHits] = useState<CardSearchHit[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)

  useEffect(() => {
    setWatchlistStore(loadWatchlistStore())
  }, [])

  useEffect(() => {
    saveWatchlistStore(watchlistStore)
  }, [watchlistStore])

  const handleSelectCard = (card: MockCardEntry) => setSelectedCard(card)
  const handleCloseDrawer = () => setSelectedCard(null)

  useEffect(() => {
    fetch("/api/anomalies")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MockCardEntry[] | null) => {
        if (Array.isArray(data) && data.length > 0) {
          setArbitrageFeed(data.map(normalizeCardEntry))
        } else {
          setArbitrageFeed((mockData as MockCardEntry[]).map(normalizeCardEntry))
        }
      })
      .catch(() => {
        setArbitrageFeed((mockData as MockCardEntry[]).map(normalizeCardEntry))
      })
      .finally(() => setFeedLoading(false))
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setSearchHits([])
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    const timer = window.setTimeout(() => {
      fetch(`/api/cards/search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data: { results?: CardSearchHit[] }) => {
          setSearchHits(data.results ?? [])
        })
        .catch(() => setSearchHits([]))
        .finally(() => setSearchLoading(false))
    }, 350)

    return () => window.clearTimeout(timer)
  }, [query])

  const feedById = useMemo(() => {
    const map = new Map<string, MockCardEntry>()
    for (const card of arbitrageFeed) map.set(card.id, card)
    return map
  }, [arbitrageFeed])

  const watchedCards = useMemo(
    () => resolveWatchedCards(watchlistStore, feedById).map(normalizeCardEntry),
    [watchlistStore, feedById],
  )

  const lookupCard = useCallback(async (hit: CardSearchHit): Promise<MockCardEntry | null> => {
    const params = hit.id.startsWith("pc-")
      ? new URLSearchParams({ id: hit.id })
      : new URLSearchParams({
          pokemonTcgId: hit.pokemonTcgId,
          cardName: hit.cardName,
          setName: hit.setName,
          cardNumber: hit.cardNumber,
        })
    if (!hit.id.startsWith("pc-") && hit.imageUrl) params.set("imageUrl", hit.imageUrl)

    const res = await fetch(`/api/cards/lookup?${params.toString()}`)
    if (!res.ok) return null
    const data = (await res.json()) as MockCardEntry
    return normalizeCardEntry(data)
  }, [])

  const toggleWatch = useCallback((card: MockCardEntry) => {
    setWatchlistStore((prev) => toggleWatchlistCard(prev, normalizeCardEntry(card)))
  }, [])

  const handleSearchSelect = useCallback(
    async (hit: CardSearchHit) => {
      setSelectedCard(searchHitToPlaceholder(hit))
      setDetailLoadingId(hit.id)
      try {
        const card = await lookupCard(hit)
        if (card) setSelectedCard(card)
      } finally {
        setDetailLoadingId(null)
      }
    },
    [lookupCard],
  )

  const handleSearchWatch = useCallback(
    async (hit: CardSearchHit) => {
      const watchedId = findWatchedIdForHit(watchlistStore, hit, feedById)
      if (watchedId) {
        const existing = watchlistStore.cards[watchedId] ?? feedById.get(watchedId)
        if (existing) {
          toggleWatch(existing)
          return
        }
      }

      setDetailLoadingId(hit.id)
      try {
        const card = await lookupCard(hit)
        if (card) toggleWatch(card)
      } finally {
        setDetailLoadingId(null)
      }
    },
    [feedById, lookupCard, toggleWatch, watchlistStore],
  )

  const checkHitWatched = useCallback(
    (hit: CardSearchHit) => isSearchHitWatched(watchlistStore, hit, feedById),
    [watchlistStore, feedById],
  )

  const fullSlabCrack = Boolean(entitlements?.fullSlabCrack)

  const results = useMemo(() => {
    // Free tier (and pre-auth default): mid-deficit preview only (not the top chase deals).
    const baseFeed =
      feed === "watchlist"
        ? watchedCards
        : fullSlabCrack
          ? arbitrageFeed
          : pickMidDeficitCards(arbitrageFeed)

    return baseFeed
      .filter((card) => {
        const matchesFeed =
          feed === "watchlist"
            ? true
            : feed === "top"
              ? card.hasPricing !== false && card.deficit > 0
              : true
        const q = query.trim().toLowerCase()
        const matchesQuery =
          feed === "watchlist" && q.length >= 2
            ? true
            : q === "" ||
              card.cardName.toLowerCase().includes(q) ||
              card.setName.toLowerCase().includes(q) ||
              card.cardNumber.toLowerCase().includes(q)
        return matchesFeed && matchesQuery
      })
      .sort((a, b) => {
        if (a.hasPricing !== b.hasPricing) return a.hasPricing ? -1 : 1
        return sortMode === "dollar" ? b.deficit - a.deficit : b.percentageSavings - a.percentageSavings
      })
  }, [arbitrageFeed, feed, fullSlabCrack, query, sortMode, watchedCards])

  const showFreePreviewBanner = !fullSlabCrack && !entitlements?.isLoading
  const freeSearchBlocked =
    !fullSlabCrack && query.trim().length >= 2 && feed !== "watchlist" && results.length === 0

  const pricedCount = useMemo(
    () => arbitrageFeed.filter((card) => card.hasPricing !== false).length,
    [arbitrageFeed],
  )

  const totalDeficit = useMemo(
    () => results.reduce((sum, card) => sum + (card.hasPricing === false ? 0 : card.deficit), 0),
    [results],
  )

  const feedItems = useMemo(
    () => interleaveFeedAds(results, entitlements?.adFree ? 0 : undefined),
    [results, entitlements?.adFree],
  )
  const showCatalogSearch =
    query.trim().length >= 2 && feed !== "watchlist" && fullSlabCrack

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="px-4 pt-5 pb-3 sm:px-6">
          <div className="flex items-center justify-between">
            <CollecToolsBrand href="/" subtitle="SlabCrack · graded slab arbitrage" size="sm" />
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Zap className="size-3 text-primary" /> Live deficits
              </span>
              <span className="font-mono text-sm font-semibold text-primary tabular-nums">
                {"$"}{totalDeficit.toFixed(2)}
              </span>
              </div>
              <SiteAuthButton className="shrink-0" />
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search card, set, or set + card…"
              className={cn(
                "h-11 w-full rounded-xl border border-border bg-secondary/60 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground",
                "outline-none transition-colors focus:border-primary/50 focus:bg-secondary",
              )}
            />
          </div>
        </div>

        {/* Feed tabs */}
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FEEDS.map((f) => {
            const active = feed === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFeed(f.id)}
                className={cn(
                  "relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
                {f.id === "watchlist" && watchlistStore.ids.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                    {watchlistStore.ids.length}
                  </span>
                )}
                {active && (
                  <span className="absolute inset-x-2 -bottom-2 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>
      </header>

      {/* Feed */}
      <main className="flex-1 px-4 py-4 sm:px-6">
        <section className="mb-4 overflow-hidden rounded-2xl border border-border bg-card/50">
          <div className="flex items-start gap-3 border-b border-border px-3.5 py-3.5 sm:px-4">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <TrendingUp className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Find undervalued cards.</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Premium unlocks the full feed of deficits.
              </p>
            </div>
          </div>
          <ol className="divide-y divide-border">
            {SLABCRACK_USES.map(({ title, body, icon: Icon }, index) => (
              <li key={title} className="flex items-start gap-3 px-3.5 py-3.5 sm:px-4">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {body}
                  </p>
                </div>
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              </li>
            ))}
          </ol>
        </section>

        {showCatalogSearch && (
          <CardSearchResults
            hits={searchHits}
            loading={searchLoading}
            query={query}
            watchedIds={watchlistStore.ids}
            isHitWatched={checkHitWatched}
            onSelect={handleSearchSelect}
            onToggleWatch={handleSearchWatch}
            detailLoadingId={detailLoadingId}
          />
        )}

        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingDown className="size-3.5 text-primary" />
            <span>
              {results.length} {results.length === 1 ? "card" : "cards"}
              {feed === "watchlist" ? " on watchlist" : " tracked"}
              {showFreePreviewBanner && (
                <> · free preview (mid-deficit)</>
              )}
              {feed !== "watchlist" && !showFreePreviewBanner && pricedCount > 0 && (
                <>
                  {" "}
                  · {pricedCount} with live pricing · by{" "}
                  {sortMode === "dollar" ? "dollar deficit" : "% discount"}
                </>
              )}
            </span>
          </div>

          {feed !== "watchlist" && (
            <div
              role="radiogroup"
              aria-label="Sort deficits by"
              className="flex items-center rounded-lg border border-border bg-secondary/40 p-0.5"
            >
              <button
                type="button"
                role="radio"
                aria-checked={sortMode === "dollar"}
                onClick={() => setSortMode("dollar")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1.5 font-mono text-xs font-semibold transition-all",
                  sortMode === "dollar"
                    ? "bg-primary/15 text-primary shadow-[0_0_14px_-6px] shadow-primary/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <DollarSign className="size-3.5" strokeWidth={2.5} />
                <span className="sr-only sm:not-sr-only">Deficit</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={sortMode === "percent"}
                onClick={() => setSortMode("percent")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1.5 font-mono text-xs font-semibold transition-all",
                  sortMode === "percent"
                    ? "bg-primary/15 text-primary shadow-[0_0_14px_-6px] shadow-primary/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Percent className="size-3.5" strokeWidth={2.5} />
                <span className="sr-only sm:not-sr-only">Discount</span>
              </button>
            </div>
          )}
        </div>

        {showFreePreviewBanner && (
          <div className="mb-4 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Crown className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Free SlabCrack preview</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Showing {FREE_SLABCRACK_LIMIT} mid-deficit cards (not the top opportunities). Search
                  and the full feed need Premium.
                </p>
                <Link
                  href="/pricing"
                  className="mt-2 inline-flex text-sm font-semibold text-primary hover:underline"
                >
                  Upgrade from $4.99/mo
                </Link>
              </div>
            </div>
          </div>
        )}

        {feedLoading ? (
          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">Loading catalog…</p>
          </div>
        ) : results.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground">
              <Search className="size-6" />
            </span>
            {freeSearchBlocked ? (
              <>
                <p className="mt-4 font-medium text-foreground">Search is a Premium feature</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Free shows a fixed 10-card mid-deficit preview. Upgrade to search any card and unlock
                  the full deficit feed.
                </p>
                <Link
                  href="/pricing"
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Start Premium trial
                </Link>
              </>
            ) : (
              <>
                <p className="mt-4 font-medium text-foreground">No slabs match your filters</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {feed === "watchlist"
                    ? "Search any card above and tap the star to add it here."
                    : "Try a card name, set (151), number (#173), or both (151 173)."}
                </p>
              </>
            )}
            <AdSlot variant="banner" slotIndex={0} className="mt-8 max-w-md" compact />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {feedItems.map((item) =>
              item.kind === "card" ? (
                <SlabRow
                  key={item.card.id}
                  card={item.card}
                  watched={watchlistStore.ids.includes(item.card.id)}
                  onClick={() => handleSelectCard(item.card)}
                />
              ) : (
                <FeedAdSlot key={`ad-${item.slotIndex}`} slotIndex={item.slotIndex} />
              ),
            )}
          </div>
        )}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          {feed === "watchlist"
            ? "Watchlist is saved on this device. Search any card for PSA 7–10 comps from PriceCharting."
            : pricedCount > 0
              ? "Top Deficits shows EN/JP slab < raw opportunities from sets released in the last 3 years."
              : "Search any card for PSA 7–10 pricing, or run discover-arbitrage to refresh the feed."}
        </p>
      </main>

      <SlabDrawer
        selectedCard={selectedCard}
        watched={
          selectedCard
            ? isSearchHitWatched(watchlistStore, selectedCard, feedById) ||
              watchlistStore.ids.includes(selectedCard.id)
            : false
        }
        onClose={handleCloseDrawer}
        onToggleWatch={toggleWatch}
      />
    </div>
  )
}
