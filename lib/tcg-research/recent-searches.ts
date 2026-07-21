import type { CardSearchHit } from "@/lib/card-lookup"
import type { TcgGame } from "@/lib/scrydex/types"

const STORAGE_KEY = "collectools:tcg-research-recent"
const MAX_RECENT = 8

export type RecentSearchHit = CardSearchHit & { game: TcgGame }

export function readRecentSearches(): RecentSearchHit[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentSearchHit[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

export function pushRecentSearch(hit: CardSearchHit, game: TcgGame) {
  if (typeof window === "undefined") return
  try {
    const next: RecentSearchHit[] = [
      { ...hit, game },
      ...readRecentSearches().filter((item) => item.id !== hit.id),
    ].slice(0, MAX_RECENT)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
}
