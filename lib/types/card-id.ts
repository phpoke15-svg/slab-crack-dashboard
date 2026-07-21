import type { CardLanguage, LegacyPriceChartingId, PokemonCatalogId } from "@/lib/types/pokemon-api"

const PC_PREFIX = "pc-"
const POKE_PREFIX = "poke-"

export function isLegacyPriceChartingCardId(cardId: string): cardId is LegacyPriceChartingId {
  return cardId.trim().startsWith(PC_PREFIX)
}

export function isPokemonCatalogCardId(cardId: string): cardId is PokemonCatalogId {
  const trimmed = cardId.trim()
  return trimmed.startsWith(POKE_PREFIX) && !trimmed.startsWith("poke-tcggo-")
}

export function legacyPcIdFromCardId(cardId: string): string | null {
  const trimmed = cardId.trim()
  if (!trimmed.startsWith(PC_PREFIX)) return null
  const legacy = trimmed.slice(PC_PREFIX.length).trim()
  return legacy || null
}

export function toPokemonCatalogId(tcgId: string): PokemonCatalogId {
  const bare = tcgId.trim().replace(/^poke-/, "")
  return `${POKE_PREFIX}${bare}` as PokemonCatalogId
}

export function bareTcgIdFromCatalogId(cardId: string): string | undefined {
  const trimmed = cardId.trim()
  if (trimmed.startsWith(POKE_PREFIX)) return trimmed.slice(POKE_PREFIX.length)
  if (trimmed.includes("-") && !trimmed.startsWith(PC_PREFIX)) return trimmed
  return undefined
}

/** Infer card language from tcg id set prefix when metadata is missing. */
export function inferCardLanguageFromTcgId(tcgId: string | null | undefined): CardLanguage {
  const id = (tcgId ?? "").toLowerCase()
  if (id.startsWith("jp") || id.includes("-jp") || id.startsWith("s-p")) return "ja"
  return "en"
}

export function normalizeLegacyPcId(value: string): string {
  return value.trim().replace(/^pc-/, "")
}
