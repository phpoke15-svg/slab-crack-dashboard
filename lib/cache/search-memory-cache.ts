import type { CardSearchHit } from "@/lib/card-lookup"

const SEARCH_CACHE_TTL_MS = 30 * 1000
const searchCache = new Map<string, { results: CardSearchHit[]; expiresAt: number }>()

export function getMemorySearchCache(cacheKey: string): CardSearchHit[] | null {
  const cached = searchCache.get(cacheKey)
  if (!cached || cached.expiresAt <= Date.now()) {
    if (cached) searchCache.delete(cacheKey)
    return null
  }
  return cached.results
}

export function setMemorySearchCache(cacheKey: string, results: CardSearchHit[]): void {
  searchCache.set(cacheKey, {
    results,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
  })
}

export function purgeMemorySearchCache(cacheKey: string): void {
  searchCache.delete(cacheKey)
}
