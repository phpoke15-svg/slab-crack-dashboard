import "server-only"

const EBAY_BROWSE_BASE = "https://api.ebay.com/buy/browse/v1"

/**
 * Active fixed-price listing count via eBay Buy Browse API.
 * Requires EBAY_OAUTH_TOKEN (user/application bearer with buy.browse scope).
 */
export async function fetchActiveListingCount(keyword: string): Promise<number | null> {
  const token = process.env.EBAY_OAUTH_TOKEN?.trim()
  if (!token) return null

  const params = new URLSearchParams({
    q: keyword,
    limit: "1",
    filter: "conditions:{NEW|USED},buyingOptions:{FIXED_PRICE}",
  })

  const response = await fetch(`${EBAY_BROWSE_BASE}/item_summary/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    console.warn(`[buyout-listings] Browse API HTTP ${response.status} for "${keyword}"`)
    return null
  }

  const payload = (await response.json()) as { total?: number }
  return typeof payload.total === "number" ? payload.total : null
}

/**
 * Fallback when Browse OAuth is unavailable: estimate liquidity from sold comp depth.
 * Uses distinct sold listing fingerprints in the scrape as a proxy for market tightness.
 */
export function estimateListingProxyFromSoldItems(
  items: Array<{ url?: string; title: string; endedAt?: string }>,
): number {
  const fingerprints = new Set<string>()
  for (const item of items) {
    const key = item.url?.trim() || `${item.title}|${item.endedAt ?? ""}`
    fingerprints.add(key)
  }
  const depth = fingerprints.size
  return Math.max(5, Math.min(80, depth))
}
