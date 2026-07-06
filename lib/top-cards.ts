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
  const num = cardNumber.split("/")[0]?.trim() ?? cardNumber
  const setShort = setName.replace(/^(Scarlet & Violet|Sword & Shield):\s*/i, "").trim()
  const base = `${name} ${num} ${setShort} pokemon`.replace(/\s+/g, " ").trim()
  return {
    raw: `${base} NM`,
    psa7: `${base} PSA 7`,
    psa8: `${base} PSA 8`,
    psa9: `${base} PSA 9`,
  }
}

export function buildSearchQuery(name: string, setName: string, cardNumber: string): string {
  const num = cardNumber.split("/")[0]?.trim() ?? cardNumber
  const setShort = setName.replace(/^(Scarlet & Violet|Sword & Shield):\s*/i, "").trim()
  return `${name} ${num} ${setShort}`.toLowerCase()
}
