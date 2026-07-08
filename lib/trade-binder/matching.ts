import type { SupabaseClient } from "@supabase/supabase-js"
import { listFriendIds } from "@/lib/trade-binder/friends"
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

export type MatchResult = {
  suggestions: MatchSuggestion[]
  error: string | null
  myHaveCount: number
  myWantCount: number
}

export async function computeMatchSuggestions(
  supabase: SupabaseClient,
  userId: string,
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
    }
  }

  const byUser = new Map<
    string,
    { theyHaveYouWant: MatchCard[]; youHaveTheyWant: MatchCard[] }
  >()

  mergeMatchRows(byUser, (theyHaveRes.data ?? []) as BinderRow[], "theyHaveYouWant")
  mergeMatchRows(byUser, (theyWantRes.data ?? []) as BinderRow[], "youHaveTheyWant")

  const friendSet = new Set(friendIds)
  const suggestions: MatchSuggestion[] = []

  for (const [otherId, match] of byUser) {
    if (match.theyHaveYouWant.length === 0 && match.youHaveTheyWant.length === 0) continue
    const profile = await fetchProfile(supabase, otherId)
    if (!profile) continue
    const mutual = Math.min(match.theyHaveYouWant.length, match.youHaveTheyWant.length)
    suggestions.push({
      userId: otherId,
      profile,
      theyHaveYouWant: match.theyHaveYouWant,
      youHaveTheyWant: match.youHaveTheyWant,
      score: match.theyHaveYouWant.length + match.youHaveTheyWant.length + mutual * 2,
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
  }
}
