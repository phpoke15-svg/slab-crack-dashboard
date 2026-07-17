function stripRarityFromName(name: string): string {
  return name.replace(/\s+\([^)]+\)/, "").trim()
}

/** Normalize a catalog card number for search (e.g. `4/102` → `#4/102`). */
export function formatCatalogCardNumber(cardNumber: string): string {
  const trimmed = cardNumber.trim()
  if (!trimmed) return ""
  return trimmed.startsWith("#") ? trimmed : `#${trimmed.replace(/^#/, "")}`
}

/**
 * Canonical price-provider search string for catalog cards.
 * Example: `Charizard Base Set #4/102`
 */
export function buildCatalogPriceSearchQuery(
  cardName: string,
  setName: string,
  cardNumber: string,
): string {
  const name = stripRarityFromName(cardName).trim()
  const set = setName.trim()
  const number = formatCatalogCardNumber(cardNumber)

  return [name, set, number].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
}

/** Store `4/102` when the set printed total is known. */
export function formatCatalogCardNumberWithTotal(number: string, printedTotal?: number): string {
  const trimmed = number.trim()
  if (!trimmed) return ""
  if (trimmed.includes("/")) return trimmed.replace(/^#/, "")
  if (printedTotal && printedTotal > 0) return `${trimmed}/${printedTotal}`
  return trimmed
}
