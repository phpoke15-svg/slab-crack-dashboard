export type AdSenseSlotVariant = "feed" | "banner" | "grid" | "result"

/** CollecTools-Feed unit — safe to ship as default; override via env if needed. */
const DEFAULT_FEED_SLOT_ID = "7057947062"
const DEFAULT_CLIENT_ID = "ca-pub-8023063687308230"

const SLOT_ENV: Record<AdSenseSlotVariant, string | undefined> = {
  feed: process.env.NEXT_PUBLIC_ADSENSE_FEED_SLOT_ID,
  banner: process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT_ID,
  grid: process.env.NEXT_PUBLIC_ADSENSE_GRID_SLOT_ID,
  result: process.env.NEXT_PUBLIC_ADSENSE_RESULT_SLOT_ID,
}

/**
 * Master switch for showing ads in the UI.
 * Keep false until AdSense is approved — set NEXT_PUBLIC_ADS_ENABLED=true on Vercel to turn on.
 */
export function isAdsDisplayEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ADS_ENABLED === "true"
}

export function getAdSenseClientId(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || DEFAULT_CLIENT_ID
}

/** Resolve slot ID for a placement; falls back to the feed slot when unset. */
export function getAdSenseSlotId(variant: AdSenseSlotVariant): string {
  return SLOT_ENV[variant] || SLOT_ENV.feed || DEFAULT_FEED_SLOT_ID
}

export function isAdSenseEnabled(variant: AdSenseSlotVariant = "feed"): boolean {
  if (!isAdsDisplayEnabled()) return false
  return Boolean(getAdSenseClientId() && getAdSenseSlotId(variant))
}
