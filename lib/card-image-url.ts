const PLACEHOLDER_HOSTS = ["placehold.co", "via.placeholder.com"]

/** True only for empty URLs or synthetic placeholder hosts — not low-res real art. */
export function isPlaceholderCardImage(url?: string | null): boolean {
  if (!url?.trim()) return true
  if (url.includes("placeholder")) return true
  try {
    const host = new URL(url).hostname
    return PLACEHOLDER_HOSTS.some((h) => host.includes(h))
  } catch {
    return true
  }
}

function priceChartingSize(url: string): number | null {
  const match = url.match(/images\.pricecharting\.com\/[^/]+\/(\d+)\.jpg/i)
  return match ? Number(match[1]) : null
}

/** True when the URL is missing or too small for large binder / drawer tiles. */
export function isLowResCardImage(url?: string | null): boolean {
  if (!url?.trim()) return true
  if (isPlaceholderCardImage(url)) return true

  const pcSize = priceChartingSize(url)
  if (pcSize != null && pcSize < 400) return true

  if (/pricecharting\.com.*\/im/i.test(url)) return true

  if (url.includes("images.pokemontcg.io") && !url.includes("_hires")) return true

  return false
}

/** Bump known CDN URL patterns to hi-res without an API round-trip. */
export function upgradeCardImageUrlSync(url: string): string {
  if (!url?.trim()) return url

  const pcMatch = url.match(/images\.pricecharting\.com\/([a-z0-9]+)\/(\d+)\.jpg/i)
  if (pcMatch) {
    const [, hash] = pcMatch
    return `https://storage.googleapis.com/images.pricecharting.com/${hash}/1600.jpg`
  }

  const gcsPcMatch = url.match(
    /storage\.googleapis\.com\/images\.pricecharting\.com\/([a-z0-9]+)\/(\d+)\.jpg/i,
  )
  if (gcsPcMatch) {
    const [, hash, size] = gcsPcMatch
    if (Number(size) < 1600) {
      return `https://storage.googleapis.com/images.pricecharting.com/${hash}/1600.jpg`
    }
  }

  if (url.includes("images.pokemontcg.io") && !url.includes("_hires")) {
    if (/\.png(?:\?|$)/i.test(url)) return url.replace(/\.png(\?.*)?$/i, "_hires.png$1")
    if (/\.jpg(?:\?|$)/i.test(url)) return url.replace(/\.jpg(\?.*)?$/i, "_hires.jpg$1")
  }

  return url
}

/** Always show the stored URL when we have one — never hide low-res art. */
export function bestDisplayCardImageUrl(url?: string | null, options?: { upgrade?: boolean }): string {
  if (!url?.trim() || isPlaceholderCardImage(url)) return "/placeholder.svg"
  if (options?.upgrade !== false) {
    const upgraded = upgradeCardImageUrlSync(url)
    if (upgraded && upgraded !== url) return upgraded
  }
  return url
}

/** Prefer a sync-upgraded URL when available; fall back to the original. */
export function bestKnownImageUrl(url?: string | null): string | null {
  if (!url?.trim() || isPlaceholderCardImage(url)) return null
  const upgraded = upgradeCardImageUrlSync(url)
  return upgraded || url
}

export function cardImageNeedsUpgrade(image?: string | null): boolean {
  return isLowResCardImage(image)
}
