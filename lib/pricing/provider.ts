import type { CardPriceRow } from "@/lib/pricing/types"

export type ActivePriceProvider = "tcggo"

/** True when a cached row should be reused for the currently configured provider. */
export function isCachedPriceFromActiveProvider(
  row: Pick<CardPriceRow, "price_source"> | null | undefined,
  provider: ActivePriceProvider | null,
): boolean {
  if (!row || !provider) return false
  const cachedSource = (row.price_source ?? "tcggo").trim().toLowerCase() || "tcggo"
  return cachedSource === "tcggo"
}

/** pokemon-api.com (TCGGO on RapidAPI) is the sole live pricing provider. */
export function getActivePriceProvider(): ActivePriceProvider | null {
  return hasTcgGoApiKey() ? "tcggo" : null
}

export function hasTcgGoApiKey(): boolean {
  return Boolean(process.env.RAPIDAPI_POKEMON_TCG_KEY?.trim())
}

export function getTcgGoApiKey(): string | undefined {
  return process.env.RAPIDAPI_POKEMON_TCG_KEY?.trim() || undefined
}

/** @deprecated PriceCharting removed — always false. */
export function hasPriceChartingApiKey(): boolean {
  return false
}

/** @deprecated PriceCharting removed — always undefined. */
export function getPriceChartingApiKey(): string | undefined {
  return undefined
}
