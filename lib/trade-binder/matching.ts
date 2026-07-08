import type { SupabaseClient } from "@supabase/supabase-js"
import { createCrossUserReader } from "@/lib/trade-binder/cross-user-client"
import { listFriendIds } from "@/lib/trade-binder/friends"
import {
  cardIdsEquivalent,
  cardIdVariants,
  cardsMatchByNameSet,
  expandCardIdList,
  nameSetKey,
} from "@/lib/trade-binder/card-id-match"
import {
  buildFairTradePairs,
  enrichMatchCardsWithPrices,
  filterCardsToFairPairs,
  MATCH_VALUE_TOLERANCE_DEFAULT,
} from "@/lib/trade-binder/match-value"
import { fetchProfile } from "@/lib/trade-binder/profile-db"
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

function filterTheyHaveYouWant(rows: BinderRow[], myWantRows: BinderRow[]): BinderRow[] {
  const wantIds = myWantRows.map((r) => r.card_id)
  const wantKeys = new Set(
    myWantRows.map((r) => nameSetKey(r.card_name, r.card_set)).filter(Boolean) as string[],
  )

  return rows.filter((row) => {
    if (wantIds.some((id) => cardIdsEquivalent(id, row.card_id))) return true
    const key = nameSetKey(row.card_name, row.card_set)
    if (key && wantKeys.has(key)) return true
    return myWantRows.some((want) => cardsMatchByNameSet(rowToMatchCard(want), row))
  })
}

function filterYouHaveTheyWant(rows: BinderRow[], myHaveRows: BinderRow[]): BinderRow[] {
  const haveIds = myHaveRows.map((r) => r.card_id)
  const haveKeys = new Set(
    myHaveRows.map((r) => nameSetKey(r.card_name, r.card_set)).filter(Boolean) as string[],
  )

  return rows.filter((row) => {
    if (haveIds.some((id) => cardIdsEquivalent(id, row.card_id))) return true
    const key = nameSetKey(row.card_name, row.card_set)
    if (key && haveKeys.has(key)) return true
    return myHaveRows.some((have) => cardsMatchByNameSet(rowToMatchCard(have), row))
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
    if (!list.some((c) => cardIdsEquivalent(c.cardId, card.cardId))) {
      list.push(card)
    }
  }
}

function attachPrices(cards: MatchCard[], priced: MatchCard[]): MatchCard[] {
  const priceById = new Map<string, number>()
  const priceByNameSet = new Map<string, number>()

  for (const card of priced) {
    if (!card.rawPrice || card.rawPrice <= 0) continue
    for (const variant of cardIdVariants(card.cardId)) {
      if (!priceById.has(variant)) priceById.set(variant, card.rawPrice)
    }
    const key = nameSetKey(card.cardName, card.cardSet)
    if (key && !priceByNameSet.has(key)) priceByNameSet.set(key, card.rawPrice)
  }

  return cards.map((card) => {
    if (card.rawPrice && card.rawPrice > 0) return card
    for (const variant of cardIdVariants(card.cardId)) {
      const rawPrice = priceById.get(variant)
      if (rawPrice && rawPrice > 0) return { ...card, rawPrice }
    }
    const key = nameSetKey(card.cardName, card.cardSet)
    const byName = key ? priceByNameSet.get(key) : undefined
    return byName ? { ...card, rawPrice: byName } : card
  })
}

export type MatchResult = {
  suggestions: MatchSuggestion[]
  error: string | null
  myHaveCount: number
  myWantCount: number
  pricesLoaded: boolean
  overlapUsers: number
}

async function fetchByCardIds(
  supabase: SupabaseClient,
  userId: string,
  status: "trade" | "wishlist",
  cardIds: string[],
) {
  if (cardIds.length === 0) return { data: [] as BinderRow[], error: null }
  return supabase
    .from("user_binders")
    .select(BINDER_SELECT)
    .eq("status", status)
    .neq("user_id", userId)
    .in("card_id", cardIds)
}

async function fetchByNameSet(
  supabase: SupabaseClient,
  userId: string,
  status: "trade" | "wishlist",
  sourceRows: BinderRow[],
) {
  const withMeta = sourceRows.filter((r) => r.card_name?.trim() && r.card_set?.trim())
  if (withMeta.length === 0) return [] as BinderRow[]

  const batches = await Promise.all(
    withMeta.map((row) =>
      supabase
        .from("user_binders")
        .select(BINDER_SELECT)
        .eq("status", status)
        .neq("user_id", userId)
        .ilike("card_name", row.card_name!.trim())
        .ilike("card_set", row.card_set!.trim()),
    ),
  )

  const merged: BinderRow[] = []
  const seen = new Set<string>()
  for (const batch of batches) {
    for (const row of (batch.data ?? []) as BinderRow[]) {
      const key = rowKey(row)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(row)
    }
  }
  return merged
}

export async function computeMatchSuggestions(
  supabase: SupabaseClient,
  userId: string,
  valueTolerance = MATCH_VALUE_TOLERANCE_DEFAULT,
): Promise<MatchResult> {
  const [{ data: myRows, error: myError }, friendIds] = await Promise.all([
    supabase.from("user_binders").select(BINDER_SELECT).eq("user_id", userId),
    listFriendIds(supabase, userId),
  ])

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
  const myWant = expandCardIdList(myWantRows.map((r) => r.card_id))
  const myHave = expandCardIdList(myHaveRows.map((r) => r.card_id))

  if (myWant.length === 0 && myHave.length === 0) {
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

  const [theyHaveRes, theyWantRes, theyHaveByName, theyWantByName] = await Promise.all([
    fetchByCardIds(crossUserReader, userId, "trade", myWant),
    fetchByCardIds(crossUserReader, userId, "wishlist", myHave),
    fetchByNameSet(crossUserReader, userId, "trade", myWantRows),
    fetchByNameSet(crossUserReader, userId, "wishlist", myHaveRows),
  ])

  if (theyHaveRes.error || theyWantRes.error) {
    return {
      suggestions: [],
      error: theyHaveRes.error?.message ?? theyWantRes.error?.message ?? "Could not load matches",
      myHaveCount: myHaveRows.length,
      myWantCount: myWantRows.length,
      pricesLoaded: false,
      overlapUsers: 0,
    }
  }

  const theyHaveRows = filterTheyHaveYouWant(
    [...((theyHaveRes.data ?? []) as BinderRow[]), ...theyHaveByName],
    myWantRows,
  )
  const theyWantRows = filterYouHaveTheyWant(
    [...((theyWantRes.data ?? []) as BinderRow[]), ...theyWantByName],
    myHaveRows,
  )

  const allOwnerIds = [...theyHaveRows, ...theyWantRows].map((row) => row.user_id)
  const { friendSet, profilesByUser } = await loadVisibilityContext(
    crossUserReader,
    userId,
    allOwnerIds,
    friendIds,
  )

  const visibleTheyHaveRows = filterRowsByBinderVisibility(
    theyHaveRows,
    userId,
    friendSet,
    profilesByUser,
  )
  const visibleTheyWantRows = filterRowsByBinderVisibility(
    theyWantRows,
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

  const uniqueCards = [...new Map(allCards.map((c) => [c.cardId, c])).values()]
  const pricedCards = await enrichMatchCardsWithPrices(uniqueCards)
  const pricesLoaded = pricedCards.some((c) => c.rawPrice && c.rawPrice > 0)

  const friendSetForScore = new Set(friendIds)
  const suggestions: MatchSuggestion[] = []

  for (const [otherId, match] of byUser) {
    if (match.theyHaveYouWant.length === 0 || match.youHaveTheyWant.length === 0) continue

    const theyHaveYouWant = attachPrices(match.theyHaveYouWant, pricedCards)
    const youHaveTheyWant = attachPrices(match.youHaveTheyWant, pricedCards)
    const fairPairs = buildFairTradePairs(theyHaveYouWant, youHaveTheyWant, valueTolerance)
    const valueVerified = fairPairs.length > 0

    const filtered = valueVerified
      ? filterCardsToFairPairs(theyHaveYouWant, youHaveTheyWant, fairPairs)
      : { theyHaveYouWant, youHaveTheyWant }

    const profile =
      profilesByUser.get(otherId) ?? (await fetchProfile(crossUserReader, otherId))
    if (!profile) continue

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
