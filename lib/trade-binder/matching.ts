import type { SupabaseClient } from "@supabase/supabase-js"
import { createCrossUserReader } from "@/lib/trade-binder/cross-user-client"
import { listFriendIds } from "@/lib/trade-binder/friends"
import {
  cardIdsEquivalent,
  cardIdVariants,
  cardsMatchIdentity,
  cardNumberKeys,
  expandCardIdList,
  cardIdentityKey,
  normalizeSetName,
} from "@/lib/trade-binder/card-id-match"
import { catalogCardsByStoredId, lookupCatalogCardsByIds } from "@/lib/trade-binder/catalog-batch"
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
  const priceByNameSet = new Map<string, number>()

  for (const card of priced) {
    if (!card.rawPrice || card.rawPrice <= 0) continue
    for (const variant of cardIdVariants(card.cardId)) {
      if (!priceById.has(variant)) priceById.set(variant, card.rawPrice)
    }
    const key = cardIdentityKey(card.cardName, card.cardSet, card.cardNumber)
    if (key && !priceByNameSet.has(key)) priceByNameSet.set(key, card.rawPrice)
  }

  return cards.map((card) => {
    if (card.rawPrice && card.rawPrice > 0) return card
    for (const variant of cardIdVariants(card.cardId)) {
      const rawPrice = priceById.get(variant)
      if (rawPrice && rawPrice > 0) return { ...card, rawPrice }
    }
    const key = cardIdentityKey(card.cardName, card.cardSet, card.cardNumber)
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

  const uniqueIds = [...new Set(cardIds)]
  const chunkSize = 80
  const merged: BinderRow[] = []
  const seen = new Set<string>()
  let lastError: { message: string } | null = null

  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from("user_binders")
      .select(BINDER_SELECT)
      .eq("status", status)
      .neq("user_id", userId)
      .in("card_id", chunk)

    if (error) {
      lastError = error
      continue
    }

    for (const row of (data ?? []) as BinderRow[]) {
      const key = rowKey(row)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(row)
    }
  }

  return { data: merged, error: lastError }
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
    withMeta.flatMap((row) => {
      const name = row.card_name!.trim()
      const set = row.card_set!.trim()
      const setCore = normalizeSetName(set)
      const queries = [
        supabase
          .from("user_binders")
          .select(BINDER_SELECT)
          .eq("status", status)
          .neq("user_id", userId)
          .ilike("card_name", name),
        supabase
          .from("user_binders")
          .select(BINDER_SELECT)
          .eq("status", status)
          .neq("user_id", userId)
          .ilike("card_set", `%${setCore}%`),
      ]
      return queries
    }),
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

  return merged.filter((row) =>
    withMeta.some((source) => cardsMatchIdentity(source, row)),
  )
}

async function fetchByCardNumbers(
  supabase: SupabaseClient,
  userId: string,
  status: "trade" | "wishlist",
  sourceRows: BinderRow[],
) {
  const numbers = [
    ...new Set(
      sourceRows.flatMap((row) => cardNumberKeys(row.card_number, row.card_name)),
    ),
  ].filter((n) => !n.includes("%"))

  if (numbers.length === 0) return [] as BinderRow[]

  const chunkSize = 40
  const merged: BinderRow[] = []
  const seen = new Set<string>()

  for (let i = 0; i < numbers.length; i += chunkSize) {
    const chunk = numbers.slice(i, i + chunkSize)
    const { data } = await supabase
      .from("user_binders")
      .select(BINDER_SELECT)
      .eq("status", status)
      .neq("user_id", userId)
      .or(chunk.map((num) => `card_number.ilike.${num}/%,card_number.eq.${num}`).join(","))

    for (const row of (data ?? []) as BinderRow[]) {
      const key = rowKey(row)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(row)
    }
  }

  return merged.filter((row) =>
    sourceRows.some((source) => cardsMatchIdentity(source, row)),
  )
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
  const [enrichedWantRows, enrichedHaveRows] = await Promise.all([
    enrichRowsMissingMeta(myWantRows),
    enrichRowsMissingMeta(myHaveRows),
  ])
  const myWant = expandCardIdList(enrichedWantRows.map((r) => r.card_id))
  const myHave = expandCardIdList(enrichedHaveRows.map((r) => r.card_id))

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

  const [theyHaveRes, theyWantRes, theyHaveByName, theyWantByName, theyHaveByNumber, theyWantByNumber] =
    await Promise.all([
    fetchByCardIds(crossUserReader, userId, "trade", myWant),
    fetchByCardIds(crossUserReader, userId, "wishlist", myHave),
    fetchByNameSet(crossUserReader, userId, "trade", enrichedWantRows),
    fetchByNameSet(crossUserReader, userId, "wishlist", enrichedHaveRows),
    fetchByCardNumbers(crossUserReader, userId, "trade", enrichedWantRows),
    fetchByCardNumbers(crossUserReader, userId, "wishlist", enrichedHaveRows),
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
    await enrichRowsMissingMeta([
      ...((theyHaveRes.data ?? []) as BinderRow[]),
      ...theyHaveByName,
      ...theyHaveByNumber,
    ]),
    enrichedWantRows,
  )
  const theyWantRows = filterYouHaveTheyWant(
    await enrichRowsMissingMeta([
      ...((theyWantRes.data ?? []) as BinderRow[]),
      ...theyWantByName,
      ...theyWantByNumber,
    ]),
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
