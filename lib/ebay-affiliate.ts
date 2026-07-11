/**
 * eBay Partner Network (EPN) affiliate link tagging.
 * Campaign ID from partnernetwork.ebay.com — safe to expose (appears in URLs).
 */

const DEFAULT_TOOL_ID = "10001"

export function getEbayCampaignId(): string {
  return (
    process.env.NEXT_PUBLIC_EBAY_CAMPAIGN_ID?.trim() ||
    process.env.EBAY_CAMPAIGN_ID?.trim() ||
    // EPN campaign for CollecTools (public in affiliate URLs)
    "5339164980"
  )
}

/** Append EPN tracking params to an eBay URL (search, item, etc.). */
export function withEbayAffiliate(url: string, customId?: string): string {
  const campId = getEbayCampaignId()
  if (!campId) return url

  try {
    const parsed = new URL(url)
    if (!/(^|\.)ebay\./i.test(parsed.hostname)) return url

    parsed.searchParams.set("mkcid", "1")
    parsed.searchParams.set("mkrid", "711-53200-19255-0")
    parsed.searchParams.set("siteid", "0")
    parsed.searchParams.set("campid", campId)
    parsed.searchParams.set("toolid", DEFAULT_TOOL_ID)
    parsed.searchParams.set("mkevt", "1")
    if (customId?.trim()) {
      parsed.searchParams.set("customid", customId.trim().slice(0, 256))
    }
    return parsed.toString()
  } catch {
    return url
  }
}

/** Build an affiliate-tagged eBay search URL. */
export function ebaySearchUrl(query: string, customId?: string): string {
  const base = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`
  return withEbayAffiliate(base, customId)
}
