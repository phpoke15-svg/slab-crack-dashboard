import "server-only"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"

export type UserWatchlistItem = {
  watchlistId: string
  cardName: string
  tool: "slabcrack" | "slablab"
}

export async function syncUserWatchlist(
  userId: string,
  tool: "slabcrack" | "slablab",
  items: UserWatchlistItem[],
): Promise<void> {
  if (!isSupabaseConfigured()) return

  const admin = createAdminClient()
  const unique = new Map<string, UserWatchlistItem>()
  for (const item of items) {
    const id = item.watchlistId?.trim()
    if (!id) continue
    unique.set(id, {
      watchlistId: id,
      cardName: item.cardName?.trim() || "Card",
      tool,
    })
  }

  const { error: deleteError } = await admin
    .from("user_card_watchlist")
    .delete()
    .eq("user_id", userId)
    .eq("tool", tool)

  if (deleteError && !deleteError.message.includes("user_card_watchlist")) {
    throw new Error(deleteError.message)
  }

  const rows = [...unique.values()].map((item) => ({
    user_id: userId,
    watchlist_id: item.watchlistId,
    card_name: item.cardName,
    tool: item.tool,
  }))

  if (rows.length === 0) return

  const { error } = await admin.from("user_card_watchlist").insert(rows)
  if (error && !error.message.includes("user_card_watchlist")) {
    throw new Error(error.message)
  }
}
