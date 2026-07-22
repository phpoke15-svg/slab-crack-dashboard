export type CatalogVariantPriceRow = {
  variant?: string | null
  condition?: string | null
  company?: string | null
  grade?: string | null
  market_price?: number | null
}

/** Prefer normal, then holo/foil variants, then everything else. */
export function variantSortRank(variant: string | null | undefined): number {
  const value = String(variant ?? "normal").toLowerCase()
  if (value === "normal") return 0
  if (value.includes("holo") || value.includes("foil")) return 1
  if (value.includes("reverse")) return 2
  return 3
}

export function pickBestRowByVariant<T extends CatalogVariantPriceRow>(
  rows: T[],
  matches: (row: T) => boolean,
): T | null {
  const candidates = rows.filter(matches).filter((row) => Number(row.market_price) > 0)
  if (candidates.length === 0) return null
  return [...candidates].sort((a, b) => variantSortRank(a.variant) - variantSortRank(b.variant))[0] ?? null
}

export function pickPsaGradeFromRows(rows: CatalogVariantPriceRow[], grade: string): number | null {
  const row = pickBestRowByVariant(
    rows,
    (entry) => (entry.company ?? "").toUpperCase() === "PSA" && String(entry.grade) === grade,
  )
  return row?.market_price != null && row.market_price > 0 ? Number(row.market_price) : null
}

export function pickPreferredGradedRows(rows: CatalogVariantPriceRow[]): CatalogVariantPriceRow[] {
  const byKey = new Map<string, CatalogVariantPriceRow>()
  for (const row of rows) {
    if (Number(row.market_price) <= 0) continue
    const company = String(row.company ?? "").trim()
    const grade = String(row.grade ?? "").trim()
    if (!company || !grade) continue
    const key = `${company.toUpperCase()}|${grade}`
    const existing = byKey.get(key)
    if (!existing || variantSortRank(row.variant) < variantSortRank(existing.variant)) {
      byKey.set(key, row)
    }
  }
  return [...byKey.values()]
}

export function pickPreferredRawRow(rows: CatalogVariantPriceRow[]): CatalogVariantPriceRow | null {
  return (
    pickBestRowByVariant(
      rows,
      (row) => (row.condition ?? "NM") === "NM" && !row.company && !row.grade,
    ) ?? pickBestRowByVariant(rows, () => !row.company && !row.grade)
  )
}
