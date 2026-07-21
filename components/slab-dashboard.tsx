"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
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
import Link from "next/link"
import { SLABLABS_HREF } from "@/lib/slabs-labs-routes"
import { cn } from "@/lib/utils"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
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
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { FREE_SLABCRACK_LIMIT, pickMidDeficitCards } from "@/lib/slab-free-tier"
import {
  loadWatchlistStore,
  resolveWatchedCards,
  saveWatchlistStore,
  toggleWatchlistCard,
  type WatchlistStore,
} from "@/lib/watchlist-storage"
import {
  isSavedForLater,
  loadSaveForLaterStore,
  resolveSavedSlabcrackCards,
  saveSaveForLaterStore,
  savedCountForSource,
  toggleSavedForLater,
  type SaveForLaterStore,
} from "@/lib/save-for-later-storage"
import { syncWatchlistToServer } from "@/lib/watchlist-server-sync"

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
  const { user } = useAuth()
  const [arbitrageFeed, setArbitrageFeed] = useState<MockCardEntry[]>(FALLBACK_FEED)
  const [feedLoading, setFeedLoading] = useState(true)
  const [feed, setFeed] = useState<Feed>("top")
  const [selectedCard, setSelectedCard] = useState<MockCardEntry | null>(null)
  const [watchlistStore, setWatchlistStore] = useState<WatchlistStore>({
    ids: [],
    cards: {},
  })
  const [saveStore, setSaveStore] = useState<SaveForLaterStore>({
    folders: [],
    items: [],
  })
  const [sortMode, setSortMode] = useState<"dollar" | "percent">("dollar")

  useEffect(() => {
    setWatchlistStore(loadWatchlistStore())
    setSaveStore(loadSaveForLaterStore())
  }, [])

  useEffect(() => {
    saveWatchlistStore(watchlistStore)
  }, [watchlistStore])

  useEffect(() => {
    saveSaveForLaterStore(saveStore)
  }, [saveStore])

  const handleSelectCard = (card: MockCardEntry) => setSelectedCard(card)
  const handleCloseDrawer = () => setSelectedCard(null)

  useEffect(() => {
    let cancelled = false
    setFeedLoading(true)
    fetch("/api/slabcrack/top")
      .then(async (res) => {
        if (!res.ok) return null
        const json = (await res.json().catch(() => null)) as { cards?: MockCardEntry[] } | null
        return Array.isArray(json?.cards) ? json.cards : null
      })
      .then((cards) => {
        if (cancelled) return
        if (cards && cards.length > 0) {
          setArbitrageFeed(cards.map(normalizeCardEntry))
        } else {
          setArbitrageFeed([])
        }
      })
      .catch(() => {
        if (!cancelled) setArbitrageFeed([])
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const feedById = useMemo(() => {
    const map = new Map<string, MockCardEntry>()
    for (const card of arbitrageFeed) map.set(card.id, card)
    return map
  }, [arbitrageFeed])

  useEffect(() => {
    if (!user) return
    const items = watchlistStore.ids.map((id) => ({
      watchlistId: id,
      cardName: watchlistStore.cards[id]?.cardName ?? feedById.get(id)?.cardName ?? "Card",
    }))
    void syncWatchlistToServer("slabcrack", items)
  }, [user, watchlistStore, feedById])

  const watchedCards = useMemo(
    () => resolveWatchedCards(watchlistStore, feedById).map(normalizeCardEntry),
    [watchlistStore, feedById],
  )

  const savedCards = useMemo(
    () => resolveSavedSlabcrackCards(saveStore, feedById).map(normalizeCardEntry),
    [saveStore, feedById],
  )

  const toggleWatch = useCallback((card: MockCardEntry) => {
    setWatchlistStore((prev) => toggleWatchlistCard(prev, normalizeCardEntry(card)))
  }, [])

  const toggleSave = useCallback((card: MockCardEntry) => {
    const normalized = normalizeCardEntry(card)
    setSaveStore((prev) =>
      toggleSavedForLater(prev, { source: "slabcrack", card: normalized }),
    )
  }, [])

  const isCardSaved = useCallback(
    (card: MockCardEntry) => isSavedForLater(saveStore, "slabcrack", card.id),
    [saveStore],
  )

  const fullSlabCrack = Boolean(entitlements?.fullSlabCrack)

  const results = useMemo(() => {
    const baseFeed =
      feed === "watchlist"
        ? watchedCards
        : feed === "saved"
          ? savedCards
          : fullSlabCrack
            ? arbitrageFeed
            : pickMidDeficitCards(arbitrageFeed)

    return baseFeed
      .filter((card) => {
        if (feed === "watchlist" || feed === "saved") return true
        if (feed === "top") return card.hasPricing !== false
        return true
      })
      .sort((a, b) => {
        if (a.hasPricing !== b.hasPricing) return a.hasPricing ? -1 : 1
        if (sortMode === "dollar") {
          return b.deficit - a.deficit || b.percentageSavings - a.percentageSavings
        }
        return b.percentageSavings - a.percentageSavings || b.deficit - a.deficit
      })
  }, [arbitrageFeed, feed, fullSlabCrack, sortMode, savedCards, watchedCards])

  const showFreePreviewBanner = !fullSlabCrack && !entitlements?.isLoading && feed === "top"

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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="px-4 pt-5 pb-3 sm:px-6">
          <div className="flex items-center justify-between">
            <CollecToolsBrand href="/" subtitle="SlabLabs · SlabCrack" size="sm" />
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

          <Link
            href={SLABLABS_HREF}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to SlabLabs
          </Link>
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
                {f.id === "saved" && savedCountForSource(saveStore, "slabcrack") > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                    {savedCountForSource(saveStore, "slabcrack")}
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

        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingDown className="size-3.5 text-primary" />
            <span>
              {results.length} {results.length === 1 ? "card" : "cards"}
              {feed === "watchlist"
                ? " on watchlist"
                : feed === "saved"
                  ? " saved for later"
                  : " tracked"}
              {showFreePreviewBanner && (
                <> · free preview (mid-deficit)</>
              )}
              {feed !== "watchlist" && feed !== "saved" && !showFreePreviewBanner && pricedCount > 0 && (
                <>
                  {" "}
              · {pricedCount} with live pricing · by{" "}
              {sortMode === "dollar" ? "PSA 10 value" : "% spread"}
                </>
              )}
            </span>
          </div>

          {feed !== "watchlist" && feed !== "saved" && (
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
                  Showing {FREE_SLABCRACK_LIMIT} mid-deficit cards from the top 100 board. Upgrade for
                  the full live deficit feed — or use TCG Research for unlimited search.
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
              <TrendingDown className="size-6" />
            </span>
            <p className="mt-4 font-medium text-foreground">No slabs in this feed</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {feed === "watchlist"
                ? "Tap the star on any card in the Top 100 board to add it here."
                : feed === "saved"
                  ? "Tap Save for later on any card to build your folder."
                  : showFreePreviewBanner
                    ? "Upgrade for the full top 100 deficit board, or open TCG Research to search any card."
                    : "Top 100 cards load from your local catalog. Run price sync if this list is empty."}
            </p>
            {showFreePreviewBanner ? (
              <Link
                href="/pricing"
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Start Premium trial
              </Link>
            ) : null}
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
                  saved={isCardSaved(item.card)}
                  onToggleSave={() => toggleSave(item.card)}
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
            ? "Watchlist is saved on this device."
            : feed === "saved"
              ? "Saved for later is stored on this device in your SlabCrack folder."
              : pricedCount > 0
                ? "Top 100 graded cards by PSA 10 market value from your local catalog."
                : "Run Scrydex price sync to populate the top 100 board."}
        </p>
      </main>

      <SlabDrawer
        selectedCard={selectedCard}
        watched={selectedCard ? watchlistStore.ids.includes(selectedCard.id) : false}
        saved={selectedCard ? isCardSaved(selectedCard) : false}
        onClose={handleCloseDrawer}
        onToggleWatch={toggleWatch}
        onToggleSave={toggleSave}
      />
    </div>
  )
}
