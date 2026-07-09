export type AdSenseSlotVariant = "feed" | "banner" | "grid" | "result"

const SLOT_ENV: Record<AdSenseSlotVariant, string | undefined> = {
  feed: process.env.NEXT_PUBLIC_ADSENSE_FEED_SLOT_ID,
  banner: process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT_ID,
  grid: process.env.NEXT_PUBLIC_ADSENSE_GRID_SLOT_ID,
  result: process.env.NEXT_PUBLIC_ADSENSE_RESULT_SLOT_ID,
}

export function getAdSenseClientId(): string | undefined {
  return process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
}

/** Resolve slot ID for a placement; falls back to the feed slot when unset. */
export function getAdSenseSlotId(variant: AdSenseSlotVariant): string | undefined {
  const clientId = getAdSenseClientId()
  if (!clientId) return undefined
  return SLOT_ENV[variant] || SLOT_ENV.feed
}

export function isAdSenseEnabled(variant: AdSenseSlotVariant = "feed"): boolean {
  return Boolean(getAdSenseClientId() && getAdSenseSlotId(variant))
}
