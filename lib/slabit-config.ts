import { isRecentSetRelease } from "@/lib/pokemon-tcg-filter"

/** SlabIt only surfaces cards from sets released within this window. */
export const SLABIT_MAX_SET_AGE_YEARS = 5

export function isSlabItEligibleRelease(
  releaseDate: string | null | undefined,
  now = new Date(),
): boolean {
  return isRecentSetRelease(releaseDate, SLABIT_MAX_SET_AGE_YEARS)
}

/** True when cache was written on the same UTC calendar day (or within 24h). */
export function isSlabItCacheFresh(syncedAt: string | null | undefined, now = new Date()): boolean {
  if (!syncedAt?.trim()) return false
  const parsed = Date.parse(syncedAt)
  if (!Number.isFinite(parsed)) return false
  if (now.getTime() - parsed > 24 * 60 * 60 * 1000) return false
  const synced = new Date(parsed)
  return (
    synced.getUTCFullYear() === now.getUTCFullYear() &&
    synced.getUTCMonth() === now.getUTCMonth() &&
    synced.getUTCDate() === now.getUTCDate()
  )
}
