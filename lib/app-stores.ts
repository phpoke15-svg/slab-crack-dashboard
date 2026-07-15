/** Native CollecTools app identifiers for SEO, manifests, and store badges. */

export const IOS_BUNDLE_ID = "com.collectools.app"
export const ANDROID_PACKAGE = "com.collectools.app"

/** App Store Connect app id (from eas.json submit.production.ios.ascAppId). */
export const IOS_APP_STORE_ID =
  process.env.NEXT_PUBLIC_IOS_APP_STORE_ID?.trim() || "6790246131"

export function iosAppStoreUrl(appId = IOS_APP_STORE_ID): string {
  return `https://apps.apple.com/app/id${appId}`
}

export function playStoreUrl(packageName = ANDROID_PACKAGE): string {
  return `https://play.google.com/store/apps/details?id=${packageName}`
}

export function hasPublishedStoreLinks(): boolean {
  return Boolean(IOS_APP_STORE_ID)
}

export const APP_STORE_SAME_AS = [
  iosAppStoreUrl(),
  playStoreUrl(),
] as const
