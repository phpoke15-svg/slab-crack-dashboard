"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { SearchX } from "lucide-react"
import { type CardStatus, type CatalogCard, type TcgCard } from "@/lib/trade-binder/cards"
import {
  addCardToBinder,
  binderCardKey,
  dedupeBinderCards,
  enrichBinderCardPrices,
  loadBinderCards,
  removeBinderEntry,
  removeCardFromBinder,
  updateBinderStatus,
  withClientKey,
} from "@/lib/trade-binder/binder"
import { binderErrorMessage } from "@/lib/trade-binder/errors"
import { bestKnownImageUrl, upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { cn } from "@/lib/utils"
import { usePokemonSearch } from "@/hooks/trade-binder/use-pokemon-search"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SearchBar } from "./search-bar"
import { CardTile } from "./card-tile"
import { SearchResultTile, type SearchResultCard } from "./search-result-tile"
import { MatchesPanel } from "@/components/trade-binder/social/matches-panel"
import { SiteAuthButton } from "@/components/site-auth-button"

type BinderTab = "search" | "have" | "want" | "matches"

const tabs: { key: BinderTab; label: string }[] = [
  { key: "search", label: "Search" },
  { key: "have", label: "I have" },
  { key: "want", label: "I want" },
  { key: "matches", label: "Matches" },
]

function tabToStatus(tab: BinderTab): CardStatus | null {
  if (tab === "have") return "trade"
  if (tab === "want") return "wishlist"
  return null
}

export function MyBinder() {
  const { user, isLoading: authLoading, runWithAuth, getSupabase } = useAuth()

  const [cards, setCards] = useState<TcgCard[]>([])
  const [binderLoading, setBinderLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<BinderTab>("search")
  const [matchCount, setMatchCount] = useState(0)
  const loadIdRef = useRef(0)

  const isSearchActive = activeTab === "search"
  const searchEnabled = isSearchActive && query.trim().length >= 2
  const { results: searchResults, isLoading: searchLoading, error: searchError, total: searchTotal } =
    usePokemonSearch(query, searchEnabled)

  const ownedById = useMemo(() => new Map(cards.map((c) => [c.id, c.status])), [cards])

  const loadBinder = useCallback(async () => {
    if (!user) {
      setCards([])
      return
    }

    const loadId = ++loadIdRef.current
    setBinderLoading(true)

    let loaded: TcgCard[] = []
    try {
      loaded = await loadBinderCards(getSupabase(), user.id)
      if (loadId !== loadIdRef.current) return
      setCards(dedupeBinderCards(loaded))
    } catch {
      if (loadId !== loadIdRef.current) return
    } finally {
      if (loadId === loadIdRef.current) setBinderLoading(false)
    }

    if (loaded.length === 0 || loadId !== loadIdRef.current) return

    void enrichBinderCardPrices(loaded).then((priced) => {
      if (loadId !== loadIdRef.current) return
      setCards((prev) => {
        const priceById = new Map(priced.filter((c) => c.rawPrice).map((c) => [c.id, c.rawPrice!]))
        if (priceById.size === 0) return prev
        return dedupeBinderCards(
          prev.map((card) => {
            const rawPrice = priceById.get(card.id)
            return rawPrice ? { ...card, rawPrice } : card
          }),
        )
      })
    })
  }, [getSupabase, user])

  useEffect(() => {
    if (!authLoading) void loadBinder()
  }, [authLoading, loadBinder])

  const setCardStatus = (id: string, status: CardStatus) => {
    if (!user) return

    const card = cards.find((c) => c.id === id)
    if (!card || card.status === status) return

    const previousStatus = card.status
    setCards((prev) =>
      dedupeBinderCards(prev.map((c) => (c.id === id ? { ...c, status } : c))),
    )

    void updateBinderStatus(getSupabase(), user.id, id, status).catch(() => {
      setCards((prev) =>
        dedupeBinderCards(prev.map((c) => (c.id === id ? { ...c, status: previousStatus } : c))),
      )
    })
  }

  const addCard = (card: SearchResultCard, status: CardStatus) => {
    runWithAuth(async () => {
      const loadId = ++loadIdRef.current
      const {
        data: { user: currentUser },
      } = await getSupabase().auth.getUser()
      if (!currentUser) return

      setSaveError(null)

      const existing = cards.find((c) => c.id === card.id)
      if (existing) {
        setCardStatus(card.id, status)
        return
      }

      const cardToSave = card
      const displayImage = bestKnownImageUrl(card.image) ?? upgradeCardImageUrlSync(card.image)
      const optimistic = withClientKey({
        ...cardToSave,
        image: displayImage,
        status,
        rawPrice: card.rawPrice,
      })

      setCards((prev) => {
        if (prev.some((c) => c.id === card.id)) return prev
        return dedupeBinderCards([optimistic, ...prev])
      })

      try {
        const entryId = await addCardToBinder(getSupabase(), currentUser.id, cardToSave, status)
        if (loadId !== loadIdRef.current) return
        setCards((prev) =>
          dedupeBinderCards(
            prev.map((c) =>
              c.clientKey === optimistic.clientKey ? { ...c, entryId } : c,
            ),
          ),
        )
      } catch (err) {
        if (loadId === loadIdRef.current) {
          setCards((prev) =>
            dedupeBinderCards(prev.filter((c) => c.clientKey !== optimistic.clientKey)),
          )
          setSaveError(binderErrorMessage(err, "Could not save card to your binder"))
        }
      }
    })
  }

  const removeCard = (key: string) => {
    if (!user) return

    const card = cards.find((c) => c.clientKey === key)
    if (!card) return

    const confirmed = window.confirm(`Remove ${card.name} from your binder?`)
    if (!confirmed) return

    setCards((prev) => dedupeBinderCards(prev.filter((c) => c.clientKey !== key)))

    const removePromise = card.entryId
      ? removeBinderEntry(getSupabase(), user.id, card.entryId)
      : removeCardFromBinder(getSupabase(), user.id, card.id)

    void removePromise.catch(() => {
      setCards((prev) => dedupeBinderCards([card, ...prev]))
      setSaveError(binderErrorMessage(null, "Could not remove card"))
    })
  }

  const visibleCards = useMemo(() => {
    const status = tabToStatus(activeTab)
    if (!status) return []
    return dedupeBinderCards(cards.filter((c) => c.status === status))
  }, [activeTab, cards])

  const filteredCount = visibleCards.length
  const gridCards = visibleCards.slice(0, 500)
  const gridTruncated = filteredCount > gridCards.length

  const tradeCount = cards.filter((c) => c.status === "trade").length
  const wishlistCount = cards.filter((c) => c.status === "wishlist").length

  const tabCount = (tab: BinderTab) => {
    if (tab === "have") return tradeCount
    if (tab === "want") return wishlistCount
    if (tab === "matches") return matchCount
    return null
  }

  const isListTab = activeTab === "have" || activeTab === "want"

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="px-4 pt-5 pb-2 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <CollecToolsBrand href="/" subtitle="PokeMatch · collect & trade" size="sm" />
            <SiteAuthButton />
          </div>

          {saveError && (
            <p className="mt-3 rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {saveError}
            </p>
          )}
        </div>

        <div
          className="flex gap-1 overflow-x-auto px-4 pb-2 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="PokeMatch sections"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.key
            const count = tabCount(tab.key)
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {count != null && count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums",
                      active ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {count}
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

      <main className="flex-1 px-4 pb-8 pt-4 sm:px-6">
        {activeTab === "matches" ? (
          <MatchesPanel active={activeTab === "matches"} onCountChange={setMatchCount} />
        ) : activeTab === "search" ? (
          <>
            <SearchBar value={query} onChange={setQuery} isLoading={searchLoading} />
            <div className="mt-4">
              {!user && (
                <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground text-pretty">
                    Sign in to save cards to your binder.
                  </p>
                  <Link
                    href="/sign-in?next=/binder"
                    className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
                  >
                    Sign in
                  </Link>
                </div>
              )}
              {query.trim().length < 2 ? (
                <EmptyState
                  title="Find any card"
                  message="Type a Pokémon name, set, or card number to search the full catalog."
                />
              ) : searchError ? (
                <EmptyState title="Search unavailable" message={searchError} />
              ) : searchLoading && searchResults.length === 0 ? (
                <EmptyState title="Searching…" message="Looking through the catalog." />
              ) : searchResults.length > 0 ? (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {searchTotal.toLocaleString()} result{searchTotal === 1 ? "" : "s"}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {searchResults.map((card, index) => {
                      const ownedStatus = ownedById.get(card.id) ?? null
                      return (
                        <SearchResultTile
                          key={`${card.id}-${index}`}
                          card={card}
                          ownedStatus={ownedStatus}
                          onAdd={(status) => addCard(card, status)}
                          onSetStatus={
                            ownedStatus
                              ? (status) => setCardStatus(card.id, status)
                              : undefined
                          }
                        />
                      )
                    })}
                  </div>
                </>
              ) : (
                <EmptyState title="No cards found" message="Try a different name or set." />
              )}
            </div>
          </>
        ) : binderLoading && user ? (
          <EmptyState title="Loading your binder" message="Syncing your collection…" />
        ) : gridCards.length > 0 ? (
          <>
            {gridTruncated && (
              <p className="mb-3 text-xs text-muted-foreground">
                Showing {gridCards.length.toLocaleString()} of {filteredCount.toLocaleString()} cards.
              </p>
            )}
            {isListTab && (
              <p className="mb-3 text-xs text-muted-foreground">
                Tap the trash icon to remove a card, or use{" "}
                <span className="text-trade">I have</span> / <span className="text-wishlist">I want</span> to move it
                between lists.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gridCards.map((card) => (
                <CardTile
                  key={binderCardKey(card)}
                  card={card}
                  onSetStatus={setCardStatus}
                  onRemove={removeCard}
                  showRemove={isListTab}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title={
              activeTab === "have" ? "Nothing listed to trade" : "Nothing on your want list"
            }
            message={
              user
                ? "Use the Search tab to find cards, then add them to I have or I want."
                : "Sign in to build your binder."
            }
            action={
              user ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("search")}
                  className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Go to Search
                </button>
              ) : (
                <Link
                  href="/sign-in?next=/binder"
                  className="mt-2 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Sign in
                </Link>
              )
            }
          />
        )}
      </main>
    </div>
  )
}

function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card/60 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
        <SearchX className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{message}</p>
        {action}
      </div>
    </div>
  )
}
