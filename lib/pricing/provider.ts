export type ActivePriceProvider = "tcggo" | "pricecharting"

/** Which backend supplies live card prices (search, sync, lazy lookup). */
export function getActivePriceProvider(): ActivePriceProvider | null {
  const configured = (process.env.PRICE_PROVIDER ?? "auto").trim().toLowerCase()

  if (configured === "tcggo") {
    return hasTcgGoApiKey() ? "tcggo" : null
  }
  if (configured === "pricecharting") {
    return hasPriceChartingApiKey() ? "pricecharting" : null
  }

  // auto: prefer TCGGO RapidAPI when configured
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
