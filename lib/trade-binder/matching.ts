import type { SupabaseClient } from "@supabase/supabase-js"
import { listFriendIds } from "@/lib/trade-binder/friends"
import {
  buildFairTradePairs,
  enrichMatchCardsWithPrices,
  filterCardsToFairPairs,
  MATCH_VALUE_TOLERANCE_DEFAULT,
} from "@/lib/trade-binder/match-value"
import { fetchProfile } from "@/lib/trade-binder/profile-db"
import type { MatchCard, MatchSuggestion } from "@/lib/trade-binder/users"

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
    cardName: row.card_name ?? "Unknown card",
    cardSet: row.card_set ?? "",
    cardImage: row.card_image ?? "",
    cardNumber: row.card_number ?? undefined,
  }
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
    byUser.get(row.user_id)![direction].push(rowToMatchCard(row))
  }
}

function attachPrices(cards: MatchCard[], priced: MatchCard[]): MatchCard[] {
  const priceById = new Map(priced.map((c) => [c.cardId, c.rawPrice]))
  return cards.map((c) => {
    const rawPrice = priceById.get(c.cardId)
    return rawPrice && rawPrice > 0 ? { ...c, rawPrice } : c
  })
}

export type MatchResult = {
  suggestions: MatchSuggestion[]
  error: string | null
  myHaveCount: number
  myWantCount: number
  pricesLoaded: boolean
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
    }
  }

  const mine = (myRows ?? []) as BinderRow[]
  const myWant = [...new Set(mine.filter((r) => r.status === "wishlist").map((r) => r.card_id))]
  const myHave = [...new Set(mine.filter((r) => r.status === "trade").map((r) => r.card_id))]

  if (myWant.length === 0 && myHave.length === 0) {
    return {
      suggestions: [],
      error: null,
      myHaveCount: 0,
      myWantCount: 0,
      pricesLoaded: false,
    }
  }

  const [theyHaveRes, theyWantRes] = await Promise.all([
    myWant.length > 0
      ? supabase
          .from("user_binders")
          .select(BINDER_SELECT)
          .eq("status", "trade")
          .neq("user_id", userId)
          .in("card_id", myWant)
      : Promise.resolve({ data: [], error: null }),
    myHave.length > 0
      ? supabase
          .from("user_binders")
          .select(BINDER_SELECT)
          .eq("status", "wishlist")
          .neq("user_id", userId)
          .in("card_id", myHave)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (theyHaveRes.error || theyWantRes.error) {
    return {
      suggestions: [],
      error: theyHaveRes.error?.message ?? theyWantRes.error?.message ?? "Could not load matches",
      myHaveCount: myHave.length,
      myWantCount: myWant.length,
      pricesLoaded: false,
    }
  }

  const byUser = new Map<
    string,
    { theyHaveYouWant: MatchCard[]; youHaveTheyWant: MatchCard[] }
  >()

  mergeMatchRows(byUser, (theyHaveRes.data ?? []) as BinderRow[], "theyHaveYouWant")
  mergeMatchRows(byUser, (theyWantRes.data ?? []) as BinderRow[], "youHaveTheyWant")

  const allCards: MatchCard[] = []
  for (const match of byUser.values()) {
    allCards.push(...match.theyHaveYouWant, ...match.youHaveTheyWant)
  }

  const uniqueCards = [...new Map(allCards.map((c) => [c.cardId, c])).values()]
  const pricedCards = await enrichMatchCardsWithPrices(uniqueCards)
  const pricesLoaded = pricedCards.some((c) => c.rawPrice && c.rawPrice > 0)

  const friendSet = new Set(friendIds)
  const suggestions: MatchSuggestion[] = []

  for (const [otherId, match] of byUser) {
    if (match.theyHaveYouWant.length === 0 || match.youHaveTheyWant.length === 0) continue

    const theyHaveYouWant = attachPrices(match.theyHaveYouWant, pricedCards)
    const youHaveTheyWant = attachPrices(match.youHaveTheyWant, pricedCards)
    const fairPairs = buildFairTradePairs(theyHaveYouWant, youHaveTheyWant, valueTolerance)
    if (fairPairs.length === 0) continue

    const filtered = filterCardsToFairPairs(theyHaveYouWant, youHaveTheyWant, fairPairs)
    const profile = await fetchProfile(supabase, otherId)
    if (!profile) continue

    suggestions.push({
      userId: otherId,
      profile,
      theyHaveYouWant: filtered.theyHaveYouWant,
      youHaveTheyWant: filtered.youHaveTheyWant,
      fairPairs,
      score: fairPairs.length * 10 + (friendSet.has(otherId) ? 5 : 0),
      isFriend: friendSet.has(otherId),
    })
  }

  suggestions.sort((a, b) => {
    if (a.isFriend !== b.isFriend) return a.isFriend ? -1 : 1
    return b.score - a.score
  })

  return {
    suggestions,
    error: null,
    myHaveCount: myHave.length,
    myWantCount: myWant.length,
    pricesLoaded,
  }
}
