"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  ArrowLeftRight,
  Clock3,
  Heart,
  Loader2,
  Search,
  SearchX,
  Users,
} from "lucide-react"
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
import { SiteFooter } from "@/components/legal/site-footer"
import { FooterAd } from "@/components/footer-ad"
import { AdSlot } from "@/components/ad-slot"
import { getGridAdInterval, interleaveWithAds } from "@/lib/feed-ads"
import { useOptionalEntitlements } from "@/components/billing/entitlements-provider"
import { SearchBar } from "./search-bar"
import { CardTile } from "./card-tile"
import { SearchResultTile, type SearchResultCard } from "./search-result-tile"
import { MatchesPanel } from "@/components/trade-binder/social/matches-panel"
import { PokeMatchSetupBanner } from "@/components/trade-binder/social/pokematch-setup-banner"
import { SiteAuthButton } from "@/components/site-auth-button"
import { TcgResearchCardPanel } from "@/components/tcg-research-card-panel"
import type { TcgResearchCardFull } from "@/lib/tcg-research/card-full"
import type { PokeMatchCardDetailInput } from "@/lib/trade-binder/pokematch-card-detail"
import type { MatchCard } from "@/lib/trade-binder/users"

type BinderTab = "search" | "have" | "want" | "pending" | "matches"

const tabs: { key: BinderTab; label: string; icon: typeof Search }[] = [
  { key: "search", label: "Search", icon: Search },
  { key: "have", label: "I have", icon: ArrowLeftRight },
  { key: "want", label: "I want", icon: Heart },
  { key: "matches", label: "Matches", icon: Users },
  { key: "pending", label: "Pending", icon: Clock3 },
]

function tabToStatus(tab: BinderTab): CardStatus | null {
  if (tab === "have") return "trade"
  if (tab === "want") return "wishlist"
  if (tab === "pending") return "pending"
  return null
}

export function MyBinder() {
  const entitlements = useOptionalEntitlements()
  const { user, isLoading: authLoading, runWithAuth, getSupabase } = useAuth()

  const [cards, setCards] = useState<TcgCard[]>([])
  const [binderLoading, setBinderLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<BinderTab>("search")
  const [matchCount, setMatchCount] = useState(0)
  const [detailPayload, setDetailPayload] = useState<TcgResearchCardFull | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const loadIdRef = useRef(0)

  const isSearchActive = activeTab === "search"
  const searchEnabled = isSearchActive
  const isBrowsingPopular = isSearchActive && query.trim().length < 2
  const { results: searchResults, isLoading: searchLoading, isPricing: searchPricing, error: searchError, total: searchTotal, featured: searchFeatured } =
    usePokemonSearch(query, searchEnabled)

  const ownedById = useMemo(() => new Map(cards.map((c) => [c.id, c.status])), [cards])

  const searchGridItems = useMemo(
    () =>
      interleaveWithAds(
        searchResults,
        entitlements?.adFree ? 0 : getGridAdInterval(),
      ),
    [searchResults, entitlements?.adFree],
  )

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

  const openCardDetail = useCallback(async (card: PokeMatchCardDetailInput) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const params = new URLSearchParams({ id: card.id, game: "pokemon" })
      const res = await fetch(`/api/tcg-research/card?${params.toString()}`)
      const json = (await res.json()) as TcgResearchCardFull & { error?: string }
      if (!res.ok || !json.card) throw new Error(json.error || "Could not load card details")
      setDetailPayload(json)
    } catch (error) {
      setDetailPayload(null)
      setDetailError(error instanceof Error ? error.message : "Could not load card details")
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const openMatchCardDetail = useCallback(
    (card: MatchCard) => {
      void openCardDetail({
        id: card.cardId,
        name: card.cardName,
        set: card.cardSet,
        image: card.cardImage,
        cardNumber: card.cardNumber,
        rawPrice: card.rawPrice,
      })
    },
    [openCardDetail],
  )

  useEffect(() => {
    if (!authLoading) void loadBinder()
  }, [authLoading, loadBinder])

  const setCardStatus = (id: string, status: CardStatus) => {
    if (!user) return

    const card = cards.find((c) => c.id === id)
    if (!card || card.status === status) return
    if (card.status === "pending") {
      setSaveError("This card is locked in an accepted trade.")
      return
    }

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
    if (card.status === "pending") {
      setSaveError("This card is locked in an accepted trade. Cancel or complete the trade first.")
      return
    }

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
  const pendingCount = cards.filter((c) => c.status === "pending").length

  const tabCount = (tab: BinderTab) => {
    if (tab === "have") return tradeCount
    if (tab === "want") return wishlistCount
    if (tab === "pending") return pendingCount
    if (tab === "matches") return matchCount
    return null
  }

  const isListTab = activeTab === "have" || activeTab === "want" || activeTab === "pending"

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
          className="flex gap-0.5 overflow-x-auto px-2 pb-2 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="PokeMatch sections"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.key
            const count = tabCount(tab.key)
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative flex min-w-[4.25rem] flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors sm:min-w-0 sm:text-xs",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("size-4", active && tab.key === "want" && "fill-current")}
                  aria-hidden="true"
                />
                <span className="inline-flex items-center gap-1">
                  {tab.label}
                  {count != null && count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1 py-px text-[9px] font-semibold tabular-nums",
                        active ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </span>
                {active && (
                  <span className="absolute inset-x-3 -bottom-2 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>
      </header>

      <main className="flex-1 px-4 pb-8 pt-4 sm:px-6">
        <PokeMatchSetupBanner />
        {activeTab === "matches" ? (
          <MatchesPanel
            active={activeTab === "matches"}
            onCountChange={setMatchCount}
            onOpenCardDetail={openMatchCardDetail}
          />
        ) : activeTab === "search" ? (
          <>
            <SearchBar value={query} onChange={setQuery} isLoading={searchLoading} />
            <div className="mt-4">
              {!user && (
                <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Save your favorites</p>
                    <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
                      Sign in to keep I have / I want lists across devices.
                    </p>
                  </div>
                  <Link
                    href="/sign-in?next=/binder"
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
                  >
                    Sign in
                  </Link>
                </div>
              )}
              {searchError ? (
                <EmptyState title="Search unavailable" message={searchError} />
              ) : searchLoading && searchResults.length === 0 ? (
                <EmptyState
                  title={isBrowsingPopular ? "Loading popular cards…" : "Searching…"}
                  message={
                    isBrowsingPopular
                      ? "Pulling top chase cards from Scrydex."
                      : "Looking through the catalog."
                  }
                />
              ) : searchResults.length > 0 ? (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {searchFeatured || isBrowsingPopular
                      ? "Popular cards by market value"
                      : `${searchTotal.toLocaleString()} result${searchTotal === 1 ? "" : "s"}`}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {searchGridItems.map((item, index) => {
                      if (item.kind === "ad") {
                        return (
                          <div
                            key={`search-ad-${item.slotIndex}`}
                            className="col-span-2 sm:col-span-3"
                          >
                            <AdSlot variant="grid" slotIndex={item.slotIndex} compact />
                          </div>
                        )
                      }
                      const card = item.value
                      const ownedStatus = ownedById.get(card.id) ?? null
                      return (
                        <SearchResultTile
                          key={`${card.id}-${index}`}
                          card={card}
                          ownedStatus={ownedStatus}
                          pricePending={searchPricing && (!card.rawPrice || card.rawPrice <= 0)}
                          onAdd={(status) => addCard(card, status)}
                          onSetStatus={
                            ownedStatus
                              ? (status) => setCardStatus(card.id, status)
                              : undefined
                          }
                          onOpenDetail={(selected) => void openCardDetail(selected)}
                        />
                      )
                    })}
                  </div>
                </>
              ) : query.trim().length >= 2 ? (
                <EmptyState title="No cards found" message="Try a different name or set." />
              ) : (
                <EmptyState
                  title="Find any card"
                  message="Type a Pokémon name, set, or card number to search the full catalog."
                />
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
            {isListTab && activeTab !== "pending" && (
              <p className="mb-3 text-xs text-muted-foreground">
                Tap the trash icon to remove a card, or use{" "}
                <span className="text-trade">I have</span> / <span className="text-wishlist">I want</span> to move it
                between lists.
              </p>
            )}
            {activeTab === "pending" && (
              <p className="mb-3 text-xs text-muted-foreground text-pretty">
                These cards are locked in accepted trades and hidden from matching until the trade completes or is
                cancelled.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gridCards.map((card) => (
                <CardTile
                  key={binderCardKey(card)}
                  card={card}
                  onSetStatus={setCardStatus}
                  onRemove={removeCard}
                  onOpenDetail={(selected) => void openCardDetail(selected)}
                  showRemove={isListTab}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title={
              activeTab === "have"
                ? "Nothing listed to trade"
                : activeTab === "want"
                  ? "Nothing on your want list"
                  : "No pending trades"
            }
            message={
              activeTab === "pending"
                ? "When you and another trader both accept a trade, those cards appear here and are removed from matching."
                : user
                  ? "Use the Search tab to find cards, then add them to I have or I want."
                  : "Sign in to build your binder."
            }
            action={
              user ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("search")}
                  className="mt-2 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
                >
                  Go to Search
                </button>
              ) : (
                <Link
                  href="/sign-in?next=/binder"
                  className="mt-2 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
                >
                  Sign in
                </Link>
              )
            }
          />
        )}
      </main>

      {detailLoading && !detailPayload ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Loading card market data…
          </div>
        </div>
      ) : null}

      {detailError && !detailPayload ? (
        <div className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {detailError}
          <button
            type="button"
            onClick={() => setDetailError(null)}
            className="ml-3 underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {detailPayload ? (
        <TcgResearchCardPanel
          payload={detailPayload}
          onClose={() => {
            setDetailPayload(null)
            setDetailError(null)
          }}
        />
      ) : null}

      <FooterAd className="mx-4 mb-4 sm:mx-6" />
      <SiteFooter className="border-t border-border px-4 py-6 sm:px-6" />
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
