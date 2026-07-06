"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Layers, Zap, TrendingDown, DollarSign, Percent } from "lucide-react"
import { cn } from "@/lib/utils"
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
import { interleaveFeedAds } from "@/lib/feed-ads"

const FALLBACK_FEED: MockCardEntry[] = []

export function SlabDashboard() {
  const [arbitrageFeed, setArbitrageFeed] = useState<MockCardEntry[]>(FALLBACK_FEED)
  const [feedLoading, setFeedLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [feed, setFeed] = useState<Feed>("top")
  const [selectedCard, setSelectedCard] = useState<MockCardEntry | null>(null)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [sortMode, setSortMode] = useState<"dollar" | "percent">("dollar")

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

  const toggleWatch = (id: string) =>
    setWatchlist((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const results = useMemo(() => {
    return arbitrageFeed
      .filter((card) => {
        const matchesFeed =
          feed === "watchlist"
            ? watchlist.includes(card.id)
            : feed === "top"
              ? card.hasPricing !== false && card.deficit > 0
              : true
        const q = query.trim().toLowerCase()
        const matchesQuery =
          q === "" ||
          card.cardName.toLowerCase().includes(q) ||
          card.setName.toLowerCase().includes(q) ||
          card.cardNumber.toLowerCase().includes(q)
        return matchesFeed && matchesQuery
      })
      .sort((a, b) => {
        if (a.hasPricing !== b.hasPricing) return a.hasPricing ? -1 : 1
        return sortMode === "dollar" ? b.deficit - a.deficit : b.percentageSavings - a.percentageSavings
      })
  }, [arbitrageFeed, feed, query, watchlist, sortMode])

  const pricedCount = useMemo(
    () => arbitrageFeed.filter((card) => card.hasPricing !== false).length,
    [arbitrageFeed],
  )

  const totalDeficit = useMemo(
    () => results.reduce((sum, card) => sum + (card.hasPricing === false ? 0 : card.deficit), 0),
    [results],
  )

  const feedItems = useMemo(() => interleaveFeedAds(results), [results])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="px-4 pt-5 pb-3 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_-4px] shadow-primary/60">
                <Layers className="size-5" strokeWidth={2.5} />
              </span>
              <div className="leading-tight">
                <h1 className="text-lg font-bold tracking-tight text-foreground">
                  Slab<span className="text-primary">Crack</span>
                </h1>
                <p className="text-[11px] text-muted-foreground">Graded slab arbitrage</p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Zap className="size-3 text-primary" /> Live deficits
              </span>
              <span className="font-mono text-sm font-semibold text-primary tabular-nums">
                {"$"}{totalDeficit.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cards or sets…"
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
                {f.id === "watchlist" && watchlist.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                    {watchlist.length}
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingDown className="size-3.5 text-primary" />
            <span>
              {results.length} {results.length === 1 ? "card" : "cards"} tracked
              {pricedCount > 0 && (
                <>
                  {" "}
                  · {pricedCount} with live pricing · by{" "}
                  {sortMode === "dollar" ? "dollar deficit" : "% discount"}
                </>
              )}
            </span>
          </div>

          {/* Sort toggle */}
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
        </div>

        {feedLoading ? (
          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">Loading catalog…</p>
          </div>
        ) : results.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground">
              <Search className="size-6" />
            </span>
            <p className="mt-4 font-medium text-foreground">No slabs match your filters</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {feed === "watchlist"
                ? "Add cards to your watchlist to track them here."
                : "Try clearing your search."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {feedItems.map((item) =>
              item.kind === "card" ? (
                <SlabRow
                  key={item.card.id}
                  card={item.card}
                  watched={watchlist.includes(item.card.id)}
                  onClick={() => handleSelectCard(item.card)}
                />
              ) : (
                <FeedAdSlot key={`ad-${item.slotIndex}`} slotIndex={item.slotIndex} />
              ),
            )}
          </div>
        )}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          {pricedCount > 0
            ? "Top Deficits shows EN/JP slab < raw opportunities from sets released in the last 3 years. Run discover-arbitrage to refresh."
            : "Run npm run discover-arbitrage to scan PriceCharting and find the best slab vs raw deals."}
        </p>
      </main>

      <SlabDrawer
        selectedCard={selectedCard}
        watched={selectedCard ? watchlist.includes(selectedCard.id) : false}
        onClose={handleCloseDrawer}
        onToggleWatch={toggleWatch}
      />
    </div>
  )
}
