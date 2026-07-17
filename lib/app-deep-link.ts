import { ANDROID_PACKAGE, iosAppStoreUrl, playStoreUrl } from "@/lib/app-stores"
import { getSiteUrl } from "@/lib/site-url"
import { cardPagePath } from "@/lib/seo/card-slugs"

/** Custom URI scheme — native app should register this route. */
export function cardCustomSchemeUrl(cardId: string): string {
  return `collectools://card/${encodeURIComponent(cardId)}`
}

/** Canonical HTTPS URL (Universal / App Links). */
export function cardUniversalLinkUrl(setSlug: string, cardSlug: string): string {
  const base = getSiteUrl().replace(/\/$/, "")
  return `${base}${cardPagePath(setSlug, cardSlug)}`
}

export function cardAppleAppArgument(setSlug: string, cardSlug: string): string {
  return cardUniversalLinkUrl(setSlug, cardSlug)
}

/** Android intent URL — opens app when installed, otherwise Play Store. */
export function cardAndroidIntentUrl(setSlug: string, cardSlug: string): string {
  const universal = encodeURIComponent(cardUniversalLinkUrl(setSlug, cardSlug))
  const fallback = encodeURIComponent(playStoreUrl())
  return `intent://${cardPagePath(setSlug, cardSlug).slice(1)}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`
}

export type MobilePlatform = "ios" | "android" | "other"

export function detectMobilePlatform(userAgent: string | null | undefined): MobilePlatform {
  const ua = (userAgent ?? "").toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return "ios"
  if (/android/.test(ua)) return "android"
  return "other"
}

export function storeUrlForPlatform(platform: MobilePlatform): string {
  if (platform === "ios") return iosAppStoreUrl()
  if (platform === "android") return playStoreUrl()
  return getSiteUrl()
}
