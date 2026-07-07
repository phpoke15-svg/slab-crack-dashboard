"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Library, SearchX, Users } from "lucide-react"
import { type CardStatus, type CatalogCard, type TcgCard } from "@/lib/trade-binder/cards"
import { addCardToBinder, loadBinderCards, updateBinderStatus } from "@/lib/trade-binder/binder"
import { cn } from "@/lib/utils"
import { usePokemonSearch } from "@/hooks/trade-binder/use-pokemon-search"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { SearchBar } from "./search-bar"
import { CardTile } from "./card-tile"
import { SearchResultTile } from "./search-result-tile"
import { AddCardFab } from "./add-card-fab"
import { useSocial } from "@/components/trade-binder/social/social-provider"
import { UserAvatar } from "@/components/trade-binder/social/user-avatar"

type Filter = "all" | CardStatus

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "trade", label: "For Trade" },
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
  const loadIdRef = useRef(0)

  const isSearching = query.trim().length >= 2
  const { results: searchResults, isLoading: searchLoading, error: searchError } = usePokemonSearch(query, isSearching)

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
      // Keep existing cards on reload failure — don't wipe the binder.
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
          setSaveError(err instanceof Error ? err.message : "Could not save card to binder")
        }
      }
    })
  }

  const visibleCards = useMemo(() => {
    return cards.filter((c) => filter === "all" || c.status === filter)
  }, [cards, filter])

  const tradeCount = cards.filter((c) => c.status === "trade").length
  const wishlistCount = cards.filter((c) => c.status === "wishlist").length

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-border">
      <header className="sticky top-0 z-10 border-b-2 border-border bg-card/95 backdrop-blur-md">
        <div className="hazard-stripes h-1.5 w-full opacity-80" aria-hidden="true" />
        <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xs border-2 border-primary/60 bg-primary/15 text-primary">
              <Library className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-2xl font-bold uppercase leading-none tracking-widest text-foreground">
                My Binder
              </h1>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <span className="text-foreground">{cards.length}</span> units ·{" "}
                <span className="text-trade">{tradeCount}</span> trade ·{" "}
                <span className="text-wishlist">{wishlistCount}</span> wishlist
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={social.openFriends}
                aria-label={`Find traders and friends (${social.friendCount} friends)`}
                className="relative flex size-9 items-center justify-center rounded-xs border-2 border-border text-foreground transition-colors hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Users className="size-4" aria-hidden="true" />
                {social.friendCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full border border-card bg-primary px-1 font-mono text-[9px] font-bold leading-none text-primary-foreground">
                    {social.friendCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => social.openProfile(social.currentUser.id)}
                aria-label="View your profile"
                className="rounded-xs transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <UserAvatar user={social.currentUser} size="sm" />
              </button>
            </div>
          </div>

          <SearchBar value={query} onChange={setQuery} isLoading={searchLoading} />

          {saveError && (
            <p className="rounded-xs border border-destructive/50 bg-destructive/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-destructive">
              {saveError}
            </p>
          )}

          {!isSearching && (
            <div className="flex items-stretch gap-0 border-2 border-border" role="tablist" aria-label="Filter cards">
              {filters.map((f, i) => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "flex-1 px-2 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    i > 0 && "border-l-2 border-border",
                    filter === f.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="metal-grain flex-1 px-4 pb-28 pt-4">
        {isSearching ? (
          <>
            {searchError ? (
              <EmptyState title="Search Offline" message={searchError} />
            ) : searchLoading && searchResults.length === 0 ? (
              <EmptyState title="Scanning Database" message="Fetching Pokemon cards from the TCG API..." />
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5">
                {searchResults.map((card) => (
                  <SearchResultTile
                    key={card.id}
                    card={card}
                    owned={ownedIds.has(card.id)}
                    onAdd={(status) => addCard(card, status)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title="No Cards Found" message="Try a different Pokemon name or set" />
            )}
          </>
        ) : binderLoading && user ? (
          <EmptyState title="Loading Binder" message="Syncing your collection..." />
        ) : visibleCards.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {visibleCards.map((card) => (
              <CardTile key={card.id} card={card} onToggle={toggleStatus} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Binder Empty"
            message={
              user
                ? "Search for Pokemon cards above to start building your collection"
                : "Sign in and search for Pokemon cards to build your binder"
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
    <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-[10px] border-2 border-border bg-card px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xs border-2 border-border bg-secondary text-muted-foreground">
        <SearchX className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="font-serif text-lg font-bold uppercase tracking-widest text-foreground">{title}</p>
        <p className="mt-1 font-mono text-xs uppercase tracking-wide text-muted-foreground text-pretty">{message}</p>
      </div>
    </div>
  )
}
