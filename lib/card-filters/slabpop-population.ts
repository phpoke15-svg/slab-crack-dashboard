import { legacyPokeIdToCatalogId } from "@/lib/scrydex/constants"
import { variantSortRank } from "@/lib/scrydex/variant-prices"
import { createReadClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { SlabPopCard } from "@/lib/card-filters/types"

export type SlabPopPopSource = NonNullable<SlabPopCard["popSource"]>

type PopulationRow = {
  catalog_id: string
  variant?: string | null
  company?: string | null
  grade?: string | null
  count?: number | null
}

type GradedPriceRow = {
  catalog_id: string
  variant?: string | null
  company?: string | null
  grade?: string | null
  market_price?: number | null
}

export function populationReportKey(catalogId: string, company: string, grade: string): string {
  return `${catalogId}::${company.toUpperCase()}::${grade}`
}

export function resolveCardCatalogId(cardId: string, scrydexId?: string | null): string | null {
  const fromLegacy = legacyPokeIdToCatalogId(cardId)
  if (fromLegacy) return fromLegacy
  const normalized = String(scrydexId ?? "").trim()
  return normalized ? `pokemon-${normalized}` : null
}

export function resolveSlabPopCount(input: {
  scrydexPop: number | null
  soldCompPop: number | null
  marketActivityPop: number
}): { popCount: number; popSource: SlabPopPopSource } | null {
  if (input.scrydexPop != null && input.scrydexPop > 0) {
    return { popCount: input.scrydexPop, popSource: "scrydex_pop" }
  }
  if (input.soldCompPop != null && input.soldCompPop > 0) {
    return { popCount: input.soldCompPop, popSource: "sold_comps" }
  }
  if (input.marketActivityPop > 0) {
    return { popCount: input.marketActivityPop, popSource: "market_activity" }
  }
  return null
}

function mergePopulationRows(index: Map<string, number>, rows: PopulationRow[]): void {
  const bestVariant = new Map<string, number>()

  for (const row of rows) {
    const catalogId = String(row.catalog_id ?? "").trim()
    const company = String(row.company ?? "").trim()
    const grade = String(row.grade ?? "").trim()
    const count = Number(row.count ?? 0)
    if (!catalogId || !company || !grade || count <= 0) continue

    const key = populationReportKey(catalogId, company, grade)
    const rank = variantSortRank(row.variant)
    const previousRank = bestVariant.get(key)
    if (previousRank != null && rank > previousRank) continue

    bestVariant.set(key, rank)
    index.set(key, count)
  }
}

export async function fetchScrydexPopulationIndex(catalogIds: string[]): Promise<Map<string, number>> {
  const index = new Map<string, number>()
  if (!isSupabaseConfigured() || catalogIds.length === 0) return index

  const supabase = createReadClient()
  const chunkSize = 150

  try {
    for (let i = 0; i < catalogIds.length; i += chunkSize) {
      const chunk = catalogIds.slice(i, i + chunkSize)
      const { data, error } = await supabase
        .from("population_reports")
        .select("catalog_id, variant, company, grade, count")
        .in("catalog_id", chunk)

      if (error) {
        if (error.code === "42P01") return index
        throw error
      }

      mergePopulationRows(index, (data ?? []) as PopulationRow[])
    }
  } catch (error) {
    console.warn("[slabpop-population] population index failed:", error)
  }

  return index
}

function mergeGradedPriceRows(index: Map<string, number>, rows: GradedPriceRow[]): void {
  const bestVariant = new Map<string, number>()

  for (const row of rows) {
    const catalogId = String(row.catalog_id ?? "").trim()
    const company = String(row.company ?? "").trim()
    const grade = String(row.grade ?? "").trim()
    const price = Number(row.market_price ?? 0)
    if (!catalogId || !company || !grade || price <= 0) continue

    const key = populationReportKey(catalogId, company, grade)
    const rank = variantSortRank(row.variant)
    const previousRank = bestVariant.get(key)
    if (previousRank != null && rank > previousRank) continue

    bestVariant.set(key, rank)
    index.set(key, Math.round(price * 100) / 100)
  }
}

/** Scrydex graded market prices keyed by catalogId::COMPANY::grade. */
export async function fetchScrydexGradedPriceIndex(
  catalogIds: string[],
): Promise<Map<string, number>> {
  const index = new Map<string, number>()
  if (!isSupabaseConfigured() || catalogIds.length === 0) return index

  const supabase = createReadClient()
  const chunkSize = 150

  try {
    for (let i = 0; i < catalogIds.length; i += chunkSize) {
      const chunk = catalogIds.slice(i, i + chunkSize)
      const { data, error } = await supabase
        .from("prices_graded")
        .select("catalog_id, variant, company, grade, market_price")
        .in("catalog_id", chunk)
        .gt("market_price", 0)

      if (error) {
        if (error.code === "42P01") return index
        throw error
      }

      mergeGradedPriceRows(index, (data ?? []) as GradedPriceRow[])
    }
  } catch (error) {
    console.warn("[slabpop-population] graded price index failed:", error)
  }

  return index
}
