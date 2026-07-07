"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Download, Loader2, SearchX, Users } from "lucide-react"
import { type CardStatus, type CatalogCard, type TcgCard } from "@/lib/trade-binder/cards"
import { addCardToBinder, bulkAddCardsToBinder, fetchUserBinder, loadBinderCards, updateBinderStatus } from "@/lib/trade-binder/binder"
import { binderErrorMessage } from "@/lib/trade-binder/errors"
import { cn } from "@/lib/utils"
import { usePokemonSearch } from "@/hooks/trade-binder/use-pokemon-search"
import { streamBinderCatalogPages } from "@/hooks/trade-binder/use-priced-catalog-search"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SearchBar } from "./search-bar"
import { CardTile } from "./card-tile"
import { SearchResultTile } from "./search-result-tile"
import { AddCardFab } from "./add-card-fab"
import { useSocial } from "@/components/trade-binder/social/social-provider"
import { UserAvatar } from "@/components/trade-binder/social/user-avatar"

type Filter = "all" | CardStatus

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "trade", label: "For trade" },
  { key: "wishlist", label: "Wishlist" },
]

export function MyBinder() {
  const social = useSocial()
  const { user, isLoading: authLoading, runWithAuth, getSupabase } = useAuth()

  const [cards, setCards] = useState<TcgCard[]>([])
  const [binderLoading, setBinderLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const loadIdRef = useRef(0)

  const isSearching = query.trim().length >= 1
  const { results: searchResults, isLoading: searchLoading, error: searchError, total: searchTotal } =
    usePokemonSearch(query, isSearching)

  const ownedIds = useMemo(() => new Set(cards.map((c) => c.id)), [cards])

  const loadBinder = useCallback(async () => {
    if (!user) {
      setCards([])
      return
    }

    const loadId = ++loadIdRef.current
    setBinderLoading(true)

    try {
      const loaded = await loadBinderCards(getSupabase(), user.id)
      if (loadId !== loadIdRef.current) return
      setCards(loaded)
    } catch {
      if (loadId !== loadIdRef.current) return
    } finally {
      if (loadId === loadIdRef.current) setBinderLoading(false)
    }
  }, [getSupabase, user])

  useEffect(() => {
    if (!authLoading) void loadBinder()
  }, [authLoading, loadBinder])

  const toggleStatus = (id: string) => {
    if (!user) return

    const card = cards.find((c) => c.id === id)
    if (!card) return

    const nextStatus: CardStatus = card.status === "trade" ? "wishlist" : "trade"
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status: nextStatus } : c)))

    void updateBinderStatus(getSupabase(), user.id, id, nextStatus).catch(() => {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status: card.status } : c)))
    })
  }

  const addCard = (card: CatalogCard, status: CardStatus) => {
    runWithAuth(async () => {
      const loadId = ++loadIdRef.current
      const {
        data: { user: currentUser },
      } = await getSupabase().auth.getUser()
      if (!currentUser) return

      setSaveError(null)
      setCards((prev) => {
        if (prev.some((c) => c.id === card.id)) return prev
        return [{ ...card, status }, ...prev]
      })
      setFilter(status)
      setQuery("")

      try {
        await addCardToBinder(getSupabase(), currentUser.id, card, status)
      } catch (err) {
        if (loadId === loadIdRef.current) {
          setCards((prev) => prev.filter((c) => c.id !== card.id))
          setSaveError(err instanceof Error ? err.message : "Could not save card to your binder")
        }
      }
    })
  }

  const visibleCards = useMemo(() => {
    return cards.filter((c) => filter === "all" || c.status === filter)
  }, [cards, filter])

  const filteredCount = visibleCards.length
  const gridCards = visibleCards.slice(0, 500)
  const gridTruncated = filteredCount > gridCards.length

  const tradeCount = cards.filter((c) => c.status === "trade").length
  const wishlistCount = cards.filter((c) => c.status === "wishlist").length

  const importAllPriced = () => {
    runWithAuth(async () => {
      const {
        data: { user: currentUser },
      } = await getSupabase().auth.getUser()
      if (!currentUser) return

      setImporting(true)
      setImportMessage(null)
      setSaveError(null)

      try {
        const existingRows = await fetchUserBinder(getSupabase(), currentUser.id)
        const skipIds = new Set(existingRows.map((row) => row.card_id))

        let addedTotal = 0
        let skippedTotal = 0
        let totalCount: number | undefined

        for await (const batch of streamBinderCatalogPages()) {
          totalCount = batch.totalCount ?? totalCount
          if (batch.cards.length === 0) break

          const { added, skipped } = await bulkAddCardsToBinder(
            getSupabase(),
            currentUser.id,
            batch.cards,
            "trade",
            { skipIds },
          )

          for (const card of batch.cards) skipIds.add(card.id)
          addedTotal += added
          skippedTotal += skipped

          const totalLabel = totalCount ? ` of ~${totalCount.toLocaleString()}` : ""
          setImportMessage(
            `Importing page ${batch.page}… ${skipIds.size.toLocaleString()} cards in binder${totalLabel}`,
          )

          if (!batch.hasMore) break
        }

        if (addedTotal === 0 && skippedTotal === 0) {
          setSaveError("No English or Japanese cards were found to import.")
          return
        }

        setImportMessage(
          `Added ${addedTotal.toLocaleString()} cards${skippedTotal > 0 ? ` (${skippedTotal.toLocaleString()} already in binder)` : ""}.`,
        )
        await loadBinder()
      } catch (err) {
        setSaveError(binderErrorMessage(err, "Could not import catalog"))
      } finally {
        setImporting(false)
      }
    })
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="px-4 pt-5 pb-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <CollecToolsBrand href="/" subtitle="Trade Binder · collect & trade" size="sm" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={social.openFriends}
                aria-label={`Find traders and friends (${social.friendCount} friends)`}
                className="relative flex size-9 items-center justify-center rounded-xl border border-border bg-secondary/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Users className="size-4" aria-hidden="true" />
                {social.friendCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground">
                    {social.friendCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => social.openProfile(social.currentUser.id)}
                aria-label="View your profile"
                className="rounded-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <UserAvatar user={social.currentUser} size="sm" />
              </button>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            <span className="text-foreground">{cards.length}</span> cards ·{" "}
            <span className="text-trade">{tradeCount}</span> for trade ·{" "}
            <span className="text-wishlist">{wishlistCount}</span> on wishlist
            <span className="text-muted-foreground/80"> · EN/JP catalog</span>
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={importAllPriced}
              disabled={importing || authLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-3.5" aria-hidden="true" />
              )}
              Import all cards
            </button>
          </div>

          {importMessage && (
            <p className="mt-2 text-xs text-primary">{importMessage}</p>
          )}

          <div className="mt-4">
            <SearchBar value={query} onChange={setQuery} isLoading={searchLoading} />
          </div>

          {saveError && (
            <p className="mt-3 rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {saveError}
            </p>
          )}
        </div>

        {!isSearching && (
          <div className="flex gap-1 overflow-x-auto px-4 pb-2 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filters.map((f) => {
              const active = filter === f.key
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                  {active && (
                    <span className="absolute inset-x-2 -bottom-2 h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </header>

      <main className="flex-1 px-4 pb-28 pt-4 sm:px-6">
        {isSearching ? (
          <>
            {searchError ? (
              <EmptyState title="Search unavailable" message={searchError} />
            ) : searchLoading && searchResults.length === 0 ? (
              <EmptyState title="Searching…" message="Loading English & Japanese cards." />
            ) : searchResults.length > 0 ? (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  {searchTotal.toLocaleString()} card{searchTotal === 1 ? "" : "s"} in catalog
                  {searchResults.length < searchTotal ? ` · showing ${searchResults.length}` : ""}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {searchResults.map((card) => (
                  <SearchResultTile
                    key={card.id}
                    card={card}
                    owned={ownedIds.has(card.id)}
                    onAdd={(status) => addCard(card, status)}
                  />
                ))}
                </div>
              </>
            ) : (
              <EmptyState title="No cards found" message="Try a different name or set." />
            )}
          </>
        ) : binderLoading && user ? (
          <EmptyState title="Loading your binder" message="Syncing your collection…" />
        ) : gridCards.length > 0 ? (
          <>
            {gridTruncated && (
              <p className="mb-3 text-xs text-muted-foreground">
                Showing {gridCards.length.toLocaleString()} of {filteredCount.toLocaleString()} binder cards. Search above to find a specific card.
              </p>
            )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gridCards.map((card) => (
              <CardTile key={card.id} card={card} onToggle={toggleStatus} />
            ))}
          </div>
          </>
        ) : (
          <EmptyState
            title="Your binder is empty"
            message={
              user
                ? "Search English & Japanese cards above, or import the full catalog."
                : "Sign in to search cards or import the catalog."
            }
          />
        )}
      </main>

      <AddCardFab ownedIds={ownedIds} onAdd={addCard} />
    </div>
  )
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card/60 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
        <SearchX className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{message}</p>
      </div>
    </div>
  )
}
