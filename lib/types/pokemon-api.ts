/**
 * Canonical CollecTools types for pokemon-api.com (TCGGO on RapidAPI).
 * USD-only pricing; English and Japanese cards share this schema.
 */

export type CardLanguage = "en" | "ja"

/** CollecTools catalog id — always `poke-{tcgId}` when resolved. */
export type PokemonCatalogId = `poke-${string}`

/** Legacy PriceCharting id prefix — deprecated, kept for migration. */
export type LegacyPriceChartingId = `pc-${string}`

export type PokemonCardImages = {
  front: string
  back?: string | null
}

/** Normalized card record used across search, binders, and slab tools. */
export type PokemonCard = {
  id: PokemonCatalogId | string
  tcgGoId?: number
  tcgId: string
  tcgplayerId?: number
  name: string
  setName: string
  setCode?: string
  number: string
  rarity?: string | null
  language: CardLanguage
  images: PokemonCardImages
}

/** TCGplayer USD baseline + eBay PSA graded medians from pokemon-api. */
export type CardPricingUsd = {
  usdMarket: number
  usdLow: number
  usdMid: number
  usdHigh?: number
  usdDirect?: number
  psa7Usd: number
  psa8Usd: number
  psa9Usd: number
  psa10Usd: number
  currency: "USD"
}

export type PriceHistorySource = "tcggo" | "tcgplayer" | "ebay"

export type PriceHistoryPointUsd = {
  date: string
  grade: number
  priceUsd: number
  saleCount?: number
  source: PriceHistorySource
}

/** Stored row shape for `card_prices` after pokemon-api migration. */
export type StoredCardPriceRow = {
  cardId: string
  rawPrice: number | null
  psa7Price: number | null
  psa8Price: number | null
  psa9Price: number | null
  psa10Price: number | null
  priceSource: "tcggo" | "ebay" | "binder_migrate" | "merged"
  tcgGoId?: number | null
  tcgplayerId?: number | null
  tcgId?: string | null
  language?: CardLanguage | null
  legacyPriceChartingId?: string | null
  cardName?: string | null
  cardSet?: string | null
  cardNumber?: string | null
  syncedAt: string
  syncError?: string | null
}

/** Backup mapping row — `card_id_legacy_map` table. */
export type CardIdLegacyMapRow = {
  legacyPcId: string
  newPokeId: string | null
  tcgGoId?: number | null
  tcgplayerId?: number | null
  tcgId?: string | null
  cardName?: string | null
  cardSet?: string | null
  cardNumber?: string | null
  language?: CardLanguage | null
  resolutionStatus: "pending" | "resolved" | "failed" | "skipped" | "manual"
  resolutionError?: string | null
  resolvedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type LegacyIdResolution = {
  legacyPcId: string
  newPokeId: PokemonCatalogId
  tcgGoId?: number
  tcgplayerId?: number
  tcgId: string
  language: CardLanguage
}
