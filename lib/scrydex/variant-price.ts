import type { ScrydexVariantPrice } from "@/lib/scrydex/types"

/** Prefer Scrydex market, then mid, then low — matches webhook extraction. */
export function resolveScrydexVariantMarket(price: ScrydexVariantPrice): number | null {
  const value =
    price.market ??
    (price as { market_price?: number | null }).market_price ??
    price.mid ??
    (price as { mid_price?: number | null }).mid_price ??
    price.low ??
    (price as { low_price?: number | null }).low_price
  return value != null && value > 0 ? Number(value) : null
}

export function isScrydexGradedVariantPrice(price: ScrydexVariantPrice | Record<string, unknown>): boolean {
  const row = price as Record<string, unknown>
  const type = String(row.type ?? row.price_type ?? "").trim().toLowerCase()
  const company = String(row.company ?? row.grading_company ?? "").trim()
  const grade = row.grade ?? row.grade_number
  if (type === "graded") return Boolean(company && grade != null && String(grade) !== "")
  if (type === "raw" || (!type && !company)) return false
  return Boolean(company && grade != null && String(grade) !== "")
}
