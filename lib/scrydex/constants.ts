import type { TcgGame } from "@/lib/scrydex/types"

export const SCRYDEX_BASE_URL = "https://api.scrydex.com"

/** Scrydex API path segment per game. */
export const SCRYDEX_GAME_PATH: Record<TcgGame, string> = {
  pokemon: "pokemon",
  lorcana: "lorcana",
  mtg: "magicthegathering",
}

export const SCRYDEX_CREDIT_COST = {
  catalog: 1,
  history: 3,
  vision: 5,
} as const

export function scrydexApiPath(game: TcgGame, suffix: string): string {
  const base = SCRYDEX_GAME_PATH[game]
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`
  return `/${base}/v1${normalized}`
}

export function toCatalogId(game: TcgGame, scrydexId: string): `${TcgGame}-${string}` {
  return `${game}-${scrydexId.trim()}`
}

export function splitCatalogId(catalogId: string): { game: TcgGame; scrydexId: string } | null {
  const match = catalogId.match(/^(pokemon|lorcana|mtg)-(.+)$/)
  if (!match) return null
  return { game: match[1] as TcgGame, scrydexId: match[2]! }
}

export function legacyPokeIdToCatalogId(legacyId: string): string | null {
  if (legacyId.startsWith("poke-")) return `pokemon-${legacyId.slice("poke-".length)}`
  return null
}

export function catalogIdToLegacyPokeId(catalogId: string): string | null {
  const parts = splitCatalogId(catalogId)
  if (!parts || parts.game !== "pokemon") return null
  return `poke-${parts.scrydexId}`
}

export function isScrydexConfigured(): boolean {
  return Boolean(process.env.SCRYDEX_API_KEY?.trim() && process.env.SCRYDEX_TEAM_ID?.trim())
}

export function scrydexDailyCreditBudget(): number {
  const raw = Number(process.env.SCRYDEX_DAILY_CREDIT_BUDGET ?? 1500)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1500
}

export function scrydexHydrationPagesPerRun(): number {
  const raw = Number(process.env.SCRYDEX_HYDRATE_PAGES_PER_RUN ?? 5)
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 20) : 5
}

export function scrydexPriceSyncMaxCards(): number {
  const raw = Number(process.env.SCRYDEX_PRICE_SYNC_MAX_CARDS ?? 400)
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 500) : 400
}

export function proxiedScrydexImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  return trimmed
}
