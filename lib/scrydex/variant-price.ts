import type { ScrydexVariantPrice } from "@/lib/scrydex/types"

/** Prefer Scrydex market, then mid, then low — matches webhook extraction. */
export function resolveScrydexVariantMarket(price: ScrydexVariantPrice): number | null {
  const value = price.market ?? price.mid ?? price.low
  return value != null && value > 0 ? Number(value) : null
}

export function isScrydexGradedVariantPrice(price: ScrydexVariantPrice): boolean {
  if (price.type === "graded") return Boolean(price.company && price.grade != null && price.grade !== "")
  if (price.type === "raw" || (!price.type && !price.company)) return false
  return Boolean(price.company && price.grade != null && price.grade !== "")
}
