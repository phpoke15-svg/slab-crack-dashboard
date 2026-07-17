import { buildCatalogPriceSearchQuery } from "@/lib/pricing/catalog-search-query"

/** Rarities treated as modern chase / slab-relevant for the top-200 seed. */
export const CHASE_RARITIES = [
  "Special Illustration Rare",
  "Hyper Rare",
  "Secret Rare",
  "Illustration Rare",
  "Ultra Rare",
  "Rare Rainbow",
  "Amazing Rare",
  "ACE SPEC Rare",
  "Double Rare",
  "Rare Holo VMAX",
  "Rare Holo V",
  "Rare Holo",
] as const

export const TOP_CARDS_LIMIT = 200

export const DEFAULT_MARKET_INSIGHT =
  "Chase-tier card tracked for slab vs raw arbitrage. Run sync-prices to refresh eBay sold comps."

export function buildChaseRarityQuery(): string {
  const parts = CHASE_RARITIES.map((r) => `rarity:"${r}"`)
  return `(${parts.join(" OR ")})`
}

export function buildEbayQueries(name: string, setName: string, cardNumber: string) {
  const base = buildCatalogPriceSearchQuery(name, setName, cardNumber)
  return {
    raw: `${base} NM`,
    psa7: `${base} PSA 7`,
    psa8: `${base} PSA 8`,
    psa9: `${base} PSA 9`,
    psa10: `${base} PSA 10`,
  }
}

export function buildSearchQuery(name: string, setName: string, cardNumber: string): string {
  return buildCatalogPriceSearchQuery(name, setName, cardNumber)
}
