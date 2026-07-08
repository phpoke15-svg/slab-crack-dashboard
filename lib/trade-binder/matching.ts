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

function rowToMatchCard(row: BinderRow): MatchCard {
  return {
    cardId: row.card_id,
    cardName: row.card_name ?? "Unknown card",
    cardSet: row.card_set ?? "",
    cardImage: row.card_image ?? "",
    cardNumber: row.card_number ?? undefined,
  }
}

export async function computeMatchSuggestions(
  supabase: SupabaseClient,
  userId: string,
): Promise<MatchSuggestion[]> {
  const [{ data: myRows }, friendIds] = await Promise.all([
    supabase
      .from("user_binders")
      .select("user_id, card_id, status, card_name, card_set, card_image, card_number")
      .eq("user_id", userId),
    listFriendIds(supabase, userId),
  ])

  const mine = (myRows ?? []) as BinderRow[]
  if (mine.length === 0) return []

  const myWant = new Set(mine.filter((r) => r.status === "wishlist").map((r) => r.card_id))
  const myHave = new Set(mine.filter((r) => r.status === "trade").map((r) => r.card_id))
  const cardIds = [...new Set(mine.map((r) => r.card_id))]
  if (cardIds.length === 0) return []

  const { data: otherRows } = await supabase
    .from("user_binders")
    .select("user_id, card_id, status, card_name, card_set, card_image, card_number")
    .neq("user_id", userId)
    .in("card_id", cardIds)

  const others = (otherRows ?? []) as BinderRow[]
  const friendSet = new Set(friendIds)

  const byUser = new Map<
    string,
    { theyHaveYouWant: MatchCard[]; youHaveTheyWant: MatchCard[] }
  >()

  for (const row of others) {
    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, { theyHaveYouWant: [], youHaveTheyWant: [] })
    }
    const bucket = byUser.get(row.user_id)!
    if (row.status === "trade" && myWant.has(row.card_id)) {
      bucket.theyHaveYouWant.push(rowToMatchCard(row))
    }
    if (row.status === "wishlist" && myHave.has(row.card_id)) {
      bucket.youHaveTheyWant.push(rowToMatchCard(row))
    }
  }

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

  return suggestions
}
