import type { CardPriceRow } from "@/lib/pricing/types"

export type ActivePriceProvider = "tcggo" | "pricecharting"

/** True when a cached row should be reused for the currently configured provider. */
export function isCachedPriceFromActiveProvider(
  row: Pick<CardPriceRow, "price_source"> | null | undefined,
  provider: ActivePriceProvider | null,
): boolean {
  if (!row || !provider) return false
  const cachedSource = (row.price_source ?? "pricecharting").trim().toLowerCase() || "pricecharting"
  return cachedSource === provider
}

/** Which backend supplies live card prices (search, sync, lazy lookup). */
export function getActivePriceProvider(): ActivePriceProvider | null {
  const configured = (process.env.PRICE_PROVIDER ?? "tcggo").trim().toLowerCase()

  if (configured === "tcggo") {
    return hasTcgGoApiKey() ? "tcggo" : null
  }
  if (configured === "pricecharting") {
    return hasPriceChartingApiKey() ? "pricecharting" : null
  }
  if (configured === "auto") {
    if (hasTcgGoApiKey()) return "tcggo"
    if (hasPriceChartingApiKey()) return "pricecharting"
    return null
  }

  // Default: pokemon-api.com (TCGGO RapidAPI) when configured.
  if (hasTcgGoApiKey()) return "tcggo"
  if (hasPriceChartingApiKey()) return "pricecharting"
  return null
}

export function hasTcgGoApiKey(): boolean {
  return Boolean(process.env.RAPIDAPI_POKEMON_TCG_KEY?.trim())
}

export function hasPriceChartingApiKey(): boolean {
  return Boolean(process.env.PRICECHARTING_API_KEY?.trim())
}

export function getTcgGoApiKey(): string | undefined {
  return process.env.RAPIDAPI_POKEMON_TCG_KEY?.trim() || undefined
}

export function getPriceChartingApiKey(): string | undefined {
  return process.env.PRICECHARTING_API_KEY?.trim() || undefined
}
