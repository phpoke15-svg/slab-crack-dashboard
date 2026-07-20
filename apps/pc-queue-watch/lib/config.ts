/** Live CollecTools site loaded in the app WebView (use www — apex 308s there). */
export const COLLECTOOLS_BASE_URL =
  process.env.EXPO_PUBLIC_COLLECTOOLS_URL?.replace(/\/$/, "") ||
  "https://www.collectools.app"

export const POKEMON_CENTER_URL = "https://www.pokemoncenter.com/"

/** Hosts that must stay inside the in-app WebView (never hand off to Chrome). */
export function isCollectoolsHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === "collectools.app" || host === "www.collectools.app") return true
  if (host === "slab-crack-dashboard.vercel.app") return true
  if (host.endsWith(".supabase.co") || host === "supabase.co") return true
  return false
}

/** Pokemon Center + Queue-it hosts allowed in the native monitor WebView. */
export function isPokemonCenterHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === "pokemoncenter.com" || host === "www.pokemoncenter.com") return true
  if (host.endsWith(".pokemoncenter.com")) return true
  if (host.endsWith(".queue-it.net") || host === "queue-it.net") return true
  return false
}
