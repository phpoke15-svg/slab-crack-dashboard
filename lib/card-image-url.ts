const PLACEHOLDER_HOSTS = ["placehold.co", "via.placeholder.com"]

/** True for empty, placeholder hosts, or known tiny PriceCharting thumbs. */
export function isPlaceholderCardImage(url?: string | null): boolean {
  if (!url?.trim()) return true
  if (url.includes("placeholder")) return true
  if (/\/(60|160)\.jpg(?:\?|$)/i.test(url)) return true
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

/** True when the URL is missing or too small for binder / drawer display. */
export function isLowResCardImage(url?: string | null): boolean {
  if (isPlaceholderCardImage(url)) return true
  if (!url) return true

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
    const [, hash, size] = pcMatch
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

/** Best URL for immediate display — sync upgrade only. */
export function bestDisplayCardImageUrl(url?: string | null): string {
  if (isPlaceholderCardImage(url)) return "/placeholder.svg"
  if (!url) return "/placeholder.svg"
  return upgradeCardImageUrlSync(url)
}
