"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Loader2, SearchX, Trash2, Users } from "lucide-react"
import { type CardStatus, type CatalogCard, type TcgCard } from "@/lib/trade-binder/cards"
import {
  addCardToBinder,
  clearUserBinder,
  loadBinderCards,
  removeCardFromBinder,
  updateBinderStatus,
} from "@/lib/trade-binder/binder"
import { binderErrorMessage } from "@/lib/trade-binder/errors"
import { cn } from "@/lib/utils"
import { usePokemonSearch } from "@/hooks/trade-binder/use-pokemon-search"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SearchBar } from "./search-bar"
import { CardTile } from "./card-tile"
import { SearchResultTile, type SearchResultCard } from "./search-result-tile"
import { resolveCatalogCardImage } from "@/lib/trade-binder/resolve-card-image"
import { useSocial } from "@/components/trade-binder/social/social-provider"
import { UserAvatar } from "@/components/trade-binder/social/user-avatar"

type BinderTab = "search" | "binder" | "have" | "want"

const tabs: { key: BinderTab; label: string }[] = [
  { key: "search", label: "Search" },
  { key: "binder", label: "My Binder" },
  { key: "have", label: "I have" },
  { key: "want", label: "I want" },
]

function tabToStatus(tab: BinderTab): CardStatus | null {
  if (tab === "have") return "trade"
  if (tab === "want") return "wishlist"
  return null
}

function statusToTab(status: CardStatus): BinderTab {
  return status === "trade" ? "have" : "want"
}

export function MyBinder() {
  const social = useSocial()
  const { user, isLoading: authLoading, runWithAuth, getSupabase } = useAuth()

  const [cards, setCards] = useState<TcgCard[]>([])
  const [binderLoading, setBinderLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<BinderTab>("search")
  const [clearing, setClearing] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
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

  const setCardStatus = (id: string, status: CardStatus) => {
    if (!user) return

    const card = cards.find((c) => c.id === id)
    if (!card || card.status === status) return

    const previousStatus = card.status
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))

    void updateBinderStatus(getSupabase(), user.id, id, status).catch(() => {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status: previousStatus } : c)))
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
        setActiveTab(statusToTab(status))
        return
      }

      const cardToSave = await resolveCatalogCardImage(card)

      setCards((prev) => [{ ...cardToSave, status }, ...prev])
      setActiveTab(statusToTab(status))

      try {
        await addCardToBinder(getSupabase(), currentUser.id, cardToSave, status)
      } catch (err) {
        if (loadId === loadIdRef.current) {
          setCards((prev) => prev.filter((c) => c.id !== card.id))
          setSaveError(binderErrorMessage(err, "Could not save card to your binder"))
        }
      }
    })
  }

  const removeCard = (id: string) => {
    if (!user) return

    const card = cards.find((c) => c.id === id)
    if (!card) return

    const confirmed = window.confirm(`Remove ${card.name} from your binder?`)
    if (!confirmed) return

    setCards((prev) => prev.filter((c) => c.id !== id))

    void removeCardFromBinder(getSupabase(), user.id, id).catch(() => {
      setCards((prev) => [card, ...prev])
      setSaveError(binderErrorMessage(null, "Could not remove card"))
    })
  }

  const visibleCards = useMemo(() => {
    const status = tabToStatus(activeTab)
    if (status) return cards.filter((c) => c.status === status)
    if (activeTab === "binder") return cards
    return []
  }, [activeTab, cards])

  const filteredCount = visibleCards.length
  const gridCards = visibleCards.slice(0, 500)
  const gridTruncated = filteredCount > gridCards.length

  const tradeCount = cards.filter((c) => c.status === "trade").length
  const wishlistCount = cards.filter((c) => c.status === "wishlist").length

  const tabCount = (tab: BinderTab) => {
    if (tab === "binder") return cards.length
    if (tab === "have") return tradeCount
    if (tab === "want") return wishlistCount
    return null
  }

  const clearBinder = () => {
    if (!user || cards.length === 0) return
    setShowClearConfirm(true)
  }

  const confirmClearBinder = () => {
    setShowClearConfirm(false)
    if (!user || cards.length === 0) return

    runWithAuth(async () => {
      const {
        data: { user: currentUser },
      } = await getSupabase().auth.getUser()
      if (!currentUser) return

      const loadId = ++loadIdRef.current
      setClearing(true)
      setSaveError(null)

      try {
        await clearUserBinder(getSupabase(), currentUser.id)
        if (loadId !== loadIdRef.current) return
        setCards([])
        setQuery("")
        setActiveTab("search")
      } catch (err) {
        if (loadId === loadIdRef.current) {
          setSaveError(binderErrorMessage(err, "Could not clear your binder"))
        }
      } finally {
        if (loadId === loadIdRef.current) setClearing(false)
      }
    })
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="px-4 pt-5 pb-2 sm:px-6">
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

          {activeTab === "binder" && user && cards.length > 0 && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={clearBinder}
                disabled={clearing || binderLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
              >
                {clearing ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-3" aria-hidden="true" />
                )}
                Clear binder
              </button>
            </div>
          )}

          {saveError && (
            <p className="mt-3 rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {saveError}
            </p>
          )}
        </div>

        <div
          className="flex gap-1 overflow-x-auto px-4 pb-2 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Trade binder sections"
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
        {activeTab === "search" ? (
          <>
            <SearchBar value={query} onChange={setQuery} isLoading={searchLoading} />
            <div className="mt-4">
              {!user ? (
                <EmptyState
                  title="Sign in to search"
                  message="Search any English or Japanese Pokémon card and add it to your binder."
                />
              ) : query.trim().length < 2 ? (
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
                    {searchResults.map((card) => {
                      const ownedStatus = ownedById.get(card.id) ?? null
                      return (
                        <SearchResultTile
                          key={card.id}
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
            {activeTab !== "binder" && (
              <p className="mb-3 text-xs text-muted-foreground">
                Tap <span className="text-trade">I have</span> or <span className="text-wishlist">I want</span> on a
                card to move it between folders.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gridCards.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  onSetStatus={setCardStatus}
                  onRemove={removeCard}
                  showRemove={activeTab === "binder"}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title={
              activeTab === "binder"
                ? "Your binder is empty"
                : activeTab === "have"
                  ? "Nothing listed to trade"
                  : "Nothing on your want list"
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
              ) : undefined
            }
          />
        )}
      </main>

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cancel clear binder"
            onClick={() => setShowClearConfirm(false)}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          <div
            role="alertdialog"
            aria-labelledby="clear-binder-title"
            aria-describedby="clear-binder-description"
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
          >
            <div className="border-b border-border px-4 py-3">
              <h2 id="clear-binder-title" className="text-base font-semibold text-foreground">
                Clear binder?
              </h2>
            </div>

            <div className="px-4 py-4">
              <p id="clear-binder-description" className="text-sm text-muted-foreground text-pretty">
                Remove all {cards.length.toLocaleString()} cards from your binder. This cannot be undone.
              </p>
            </div>

            <div className="flex gap-2 border-t border-border p-4">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClearBinder}
                disabled={clearing}
                className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
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
