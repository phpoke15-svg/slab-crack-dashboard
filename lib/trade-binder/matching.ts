import type { SupabaseClient } from "@supabase/supabase-js"
import { blockExclusionSet, listBlockRelations } from "@/lib/trade-binder/blocks"
import { createCrossUserReader } from "@/lib/trade-binder/cross-user-client"
import { listFriendIds } from "@/lib/trade-binder/friends"
import {
  cardIdsEquivalent,
  cardIdVariants,
  cardsMatchIdentity,
  cardIdentityKey,
} from "@/lib/trade-binder/card-id-match"
import { catalogCardsByStoredId, lookupCatalogCardsByIds } from "@/lib/trade-binder/catalog-batch"
import {
  buildFairTradePairs,
  enrichMatchCardsWithPrices,
  filterCardsToFairPairs,
  MATCH_VALUE_TOLERANCE_DEFAULT,
} from "@/lib/trade-binder/match-value"
import { fetchProfile } from "@/lib/trade-binder/profile-db"
import type { TraderProfile } from "@/lib/trade-binder/profile"
import type { MatchCard, MatchSuggestion } from "@/lib/trade-binder/users"
import {
  filterRowsByBinderVisibility,
  loadVisibilityContext,
} from "@/lib/trade-binder/visibility-filter"

type BinderRow = {
  user_id: string
  card_id: string
  status: "trade" | "wishlist"
  card_name: string | null
  card_set: string | null
  card_image: string | null
  card_number: string | null
}

const BINDER_SELECT =
  "user_id, card_id, status, card_name, card_set, card_image, card_number"

function rowToMatchCard(row: BinderRow): MatchCard {
  return {
    cardId: row.card_id,
    cardName: row.card_name?.trim() || "Unknown card",
    cardSet: row.card_set?.trim() || "",
    cardImage: row.card_image ?? "",
    cardNumber: row.card_number ?? undefined,
  }
}

function rowKey(row: BinderRow): string {
  return `${row.user_id}:${row.card_id}`
}

function stripPokemonApiId(cardId: string): string {
  return cardId.startsWith("poke-") ? cardId.slice("poke-".length) : cardId
}

async function enrichRowsMissingMeta(rows: BinderRow[]): Promise<BinderRow[]> {
  const need = rows.filter((r) => !r.card_name?.trim() || !r.card_set?.trim())
  if (need.length === 0) return rows

  const catalog = await lookupCatalogCardsByIds(need.map((r) => r.card_id))
  const byId = catalogCardsByStoredId(catalog)

  return rows.map((row) => {
    if (row.card_name?.trim() && row.card_set?.trim()) return row
    const card = byId.get(row.card_id) ?? byId.get(stripPokemonApiId(row.card_id))
    if (!card) return row
    return {
      ...row,
      card_name: card.name,
      card_set: card.set,
      card_image: row.card_image ?? card.image,
    }
  })
}

function filterTheyHaveYouWant(rows: BinderRow[], myWantRows: BinderRow[]): BinderRow[] {
  const wantIds = myWantRows.map((r) => r.card_id)
  const wantKeys = new Set(
    myWantRows
      .map((r) => cardIdentityKey(r.card_name, r.card_set, r.card_number))
      .filter(Boolean) as string[],
  )

  return rows.filter((row) => {
    if (wantIds.some((id) => cardIdsEquivalent(id, row.card_id))) return true
    const key = cardIdentityKey(row.card_name, row.card_set, row.card_number)
    if (key && wantKeys.has(key)) return true
    return myWantRows.some((want) => cardsMatchIdentity(want, row))
  })
}

function filterYouHaveTheyWant(rows: BinderRow[], myHaveRows: BinderRow[]): BinderRow[] {
  const haveIds = myHaveRows.map((r) => r.card_id)
  const haveKeys = new Set(
    myHaveRows
      .map((r) => cardIdentityKey(r.card_name, r.card_set, r.card_number))
      .filter(Boolean) as string[],
  )

  return rows.filter((row) => {
    if (haveIds.some((id) => cardIdsEquivalent(id, row.card_id))) return true
    const key = cardIdentityKey(row.card_name, row.card_set, row.card_number)
    if (key && haveKeys.has(key)) return true
    return myHaveRows.some((have) => cardsMatchIdentity(have, row))
  })
}

function mergeMatchRows(
  byUser: Map<string, { theyHaveYouWant: MatchCard[]; youHaveTheyWant: MatchCard[] }>,
  rows: BinderRow[],
  direction: "theyHaveYouWant" | "youHaveTheyWant",
) {
  for (const row of rows) {
    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, { theyHaveYouWant: [], youHaveTheyWant: [] })
    }
    const bucket = byUser.get(row.user_id)!
    const card = rowToMatchCard(row)
    const list = bucket[direction]
    if (!list.some((c) => cardIdsEquivalent(c.cardId, card.cardId) || cardsMatchIdentity(c, card))) {
      list.push(card)
    }
  }
}

function attachPrices(cards: MatchCard[], priced: MatchCard[]): MatchCard[] {
  const priceById = new Map<string, number>()

  for (const card of priced) {
    if (!card.rawPrice || card.rawPrice <= 0) continue
    registerPriceFromCard(card, priceById)
  }

  return cards.map((card) => {
    if (card.rawPrice && card.rawPrice > 0) return card
    for (const other of priced) {
      if (!other.rawPrice || other.rawPrice <= 0) continue
      if (cardsMatchIdentity(card, other)) return { ...card, rawPrice: other.rawPrice }
    }
    for (const variant of cardIdVariants(card.cardId)) {
      const rawPrice = priceById.get(variant)
      if (rawPrice && rawPrice > 0) return { ...card, rawPrice }
    }
    return card
  })
}

function registerPriceFromCard(card: MatchCard, priceById: Map<string, number>) {
  if (!card.rawPrice || card.rawPrice <= 0) return
  for (const variant of cardIdVariants(card.cardId)) {
    if (!priceById.has(variant)) priceById.set(variant, card.rawPrice)
  }
}

function fallbackProfile(userId: string): TraderProfile {
  return {
    id: userId,
    name: "Trader",
    handle: "@trader",
    avatar: "",
    location: "",
    bio: "",
    binderVisibility: "public",
  }
}

export type MatchResult = {
  suggestions: MatchSuggestion[]
  error: string | null
  myHaveCount: number
  myWantCount: number
  pricesLoaded: boolean
  overlapUsers: number
}

async function fetchAllOtherBinderRows(
  supabase: SupabaseClient,
  userId: string,
  status: "trade" | "wishlist",
): Promise<BinderRow[]> {
  const pageSize = 1000
  let from = 0
  const all: BinderRow[] = []

  while (true) {
    const { data, error } = await supabase
      .from("user_binders")
      .select(BINDER_SELECT)
      .eq("status", status)
      .neq("user_id", userId)
      .order("user_id")
      .order("card_id")
      .range(from, from + pageSize - 1)

    if (error) return all
    if (!data?.length) break

    all.push(...(data as BinderRow[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  return all
}

export async function computeMatchSuggestions(
  supabase: SupabaseClient,
  userId: string,
  valueTolerance = MATCH_VALUE_TOLERANCE_DEFAULT,
): Promise<MatchResult> {
  const [{ data: myRows, error: myError }, friendIds, blockRelations] = await Promise.all([
    supabase.from("user_binders").select(BINDER_SELECT).eq("user_id", userId),
    listFriendIds(supabase, userId),
    listBlockRelations(supabase, userId),
  ])
  const blockedUsers = blockExclusionSet(blockRelations)

  if (myError) {
    return {
      suggestions: [],
      error: myError.message,
      myHaveCount: 0,
      myWantCount: 0,
      pricesLoaded: false,
      overlapUsers: 0,
    }
  }

  const mine = (myRows ?? []) as BinderRow[]
  const myWantRows = mine.filter((r) => r.status === "wishlist")
  const myHaveRows = mine.filter((r) => r.status === "trade")
  const [enrichedWantRows, enrichedHaveRows] = await Promise.all([
    enrichRowsMissingMeta(myWantRows),
    enrichRowsMissingMeta(myHaveRows),
  ])
  if (myWantRows.length === 0 && myHaveRows.length === 0) {
    return {
      suggestions: [],
      error: null,
      myHaveCount: 0,
      myWantCount: 0,
      pricesLoaded: false,
      overlapUsers: 0,
    }
  }

  const crossUserReader = createCrossUserReader() ?? supabase

  const [allTheyHave, allTheyWant] = await Promise.all([
    fetchAllOtherBinderRows(crossUserReader, userId, "trade"),
    fetchAllOtherBinderRows(crossUserReader, userId, "wishlist"),
  ])

  const theyHaveRows = filterTheyHaveYouWant(
    await enrichRowsMissingMeta(allTheyHave),
    enrichedWantRows,
  )
  const theyWantRows = filterYouHaveTheyWant(
    await enrichRowsMissingMeta(allTheyWant),
    enrichedHaveRows,
  )

  const allOwnerIds = [...theyHaveRows, ...theyWantRows].map((row) => row.user_id)
  const { friendSet, profilesByUser } = await loadVisibilityContext(
    crossUserReader,
    userId,
    allOwnerIds,
    friendIds,
  )

  const visibleTheyHaveRows = filterRowsByBinderVisibility(
    theyHaveRows.filter((row) => !blockedUsers.has(row.user_id)),
    userId,
    friendSet,
    profilesByUser,
  )
  const visibleTheyWantRows = filterRowsByBinderVisibility(
    theyWantRows.filter((row) => !blockedUsers.has(row.user_id)),
    userId,
    friendSet,
    profilesByUser,
  )

  const byUser = new Map<
    string,
    { theyHaveYouWant: MatchCard[]; youHaveTheyWant: MatchCard[] }
  >()

  mergeMatchRows(byUser, visibleTheyHaveRows, "theyHaveYouWant")
  mergeMatchRows(byUser, visibleTheyWantRows, "youHaveTheyWant")

  const overlapUsers = [...byUser.values()].filter(
    (m) => m.theyHaveYouWant.length > 0 && m.youHaveTheyWant.length > 0,
  ).length

  const allCards: MatchCard[] = []
  for (const match of byUser.values()) {
    allCards.push(...match.theyHaveYouWant, ...match.youHaveTheyWant)
  }

  const myCards = [...enrichedWantRows, ...enrichedHaveRows].map(rowToMatchCard)
  const uniqueCards = [
    ...new Map(
      [...allCards, ...myCards].map((c) => [c.cardId, c]),
    ).values(),
  ]
  const pricedCards = await enrichMatchCardsWithPrices(uniqueCards)
  const pricesLoaded = pricedCards.some((c) => c.rawPrice && c.rawPrice > 0)

  const friendSetForScore = new Set(friendIds)
  const suggestions: MatchSuggestion[] = []

  for (const [otherId, match] of byUser) {
    if (blockedUsers.has(otherId)) continue
    if (match.theyHaveYouWant.length === 0 || match.youHaveTheyWant.length === 0) continue

    const theyHaveYouWant = attachPrices(match.theyHaveYouWant, pricedCards)
    const youHaveTheyWant = attachPrices(match.youHaveTheyWant, pricedCards)
    const fairPairs = buildFairTradePairs(theyHaveYouWant, youHaveTheyWant, valueTolerance)
    const valueVerified = fairPairs.length > 0

    const filtered = valueVerified
      ? filterCardsToFairPairs(theyHaveYouWant, youHaveTheyWant, fairPairs)
      : { theyHaveYouWant, youHaveTheyWant }

    const profile =
      profilesByUser.get(otherId) ??
      (await fetchProfile(crossUserReader, otherId)) ??
      fallbackProfile(otherId)
    suggestions.push({
      userId: otherId,
      profile,
      theyHaveYouWant: filtered.theyHaveYouWant,
      youHaveTheyWant: filtered.youHaveTheyWant,
      fairPairs,
      valueVerified,
      score:
        (fairPairs.length || Math.min(filtered.theyHaveYouWant.length, filtered.youHaveTheyWant.length)) *
          10 +
        (friendSetForScore.has(otherId) ? 5 : 0),
      isFriend: friendSetForScore.has(otherId),
    })
  }

  suggestions.sort((a, b) => {
    if (a.isFriend !== b.isFriend) return a.isFriend ? -1 : 1
    return b.score - a.score
  })

  return {
    suggestions,
    error: null,
    myHaveCount: myHaveRows.length,
    myWantCount: myWantRows.length,
    pricesLoaded,
    overlapUsers,
  }
}
