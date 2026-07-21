import { cardPriceRowToMockEntry } from "@/lib/pricing/views"
import { ensureScrydexCardFresh } from "@/lib/scrydex/on-demand"
import { isScrydexConfigured } from "@/lib/scrydex/constants"
import { loadCardBundle } from "@/lib/scrydex/db"
import { scrydexBundleToCardPriceRow } from "@/lib/scrydex/price-adapter"
import { resolveCatalogId, splitCatalogId } from "@/lib/scrydex/constants"
import type { TcgGame } from "@/lib/scrydex/types"
import {
  buildGradeQuotes,
  normalizeCardEntry,
  type MockCardEntry,
  type RecentSale,
} from "@/lib/slab-data"
import { resolveTcgResearchCard, type TcgResearchCardDetail } from "@/lib/tcg-research/card-detail"

export type TcgResearchPopulationRow = {
  company: string
  grade: string
  count: number
  gradeTotal: number | null
}

export type TcgResearchCardFull = {
  card: MockCardEntry
  catalogId: string | null
  scrydexId: string | null
  game: TcgGame
  priceUpdatedAt: string | null
  priceSource: string | null
  population: TcgResearchPopulationRow[]
}

function mergeMockEntry(base: MockCardEntry, incoming: MockCardEntry): MockCardEntry {
  return normalizeCardEntry({
    ...base,
    ...incoming,
    id: base.id || incoming.id,
    imageUrl: incoming.imageUrl || base.imageUrl,
    gradeQuotes: incoming.gradeQuotes?.length ? incoming.gradeQuotes : base.gradeQuotes,
    recentRawSales: incoming.recentRawSales?.length ? incoming.recentRawSales : base.recentRawSales,
    recentSlabSales: incoming.recentSlabSales?.length ? incoming.recentSlabSales : base.recentSlabSales,
    hasPricing: incoming.hasPricing !== false || base.hasPricing !== false,
    marketInsight: incoming.marketInsight || base.marketInsight,
  })
}

function detailToMockEntry(detail: TcgResearchCardDetail): MockCardEntry {
  const raw = detail.rawPrice ?? 0
  const byGrade = {
    ...(detail.psa7Price ? { 7: { slabPrice: detail.psa7Price, recentSlabSales: [] as RecentSale[] } } : {}),
    ...(detail.psa8Price ? { 8: { slabPrice: detail.psa8Price, recentSlabSales: [] as RecentSale[] } } : {}),
    ...(detail.psa9Price ? { 9: { slabPrice: detail.psa9Price, recentSlabSales: [] as RecentSale[] } } : {}),
    ...(detail.psa10Price ? { 10: { slabPrice: detail.psa10Price, recentSlabSales: [] as RecentSale[] } } : {}),
  }

  return normalizeCardEntry({
    id: detail.id,
    pokemonTcgId: detail.scrydexId ?? detail.id.replace(/^poke-/, ""),
    cardName: detail.name,
    setName: detail.setName,
    cardNumber: detail.number,
    imageUrl: detail.imageUrl,
    rawPrice: raw,
    slabGrade: 10,
    slabPrice: detail.psa10Price ?? 0,
    gradeQuotes: buildGradeQuotes(raw, byGrade),
    hasPricing: raw > 0 || Object.keys(byGrade).length > 0,
    marketInsight: "Scrydex catalog prices. Sold comps and history load from Scrydex on demand.",
  })
}

function bundlePopulation(
  rows: Array<{ company?: string; grade?: string; count?: number; grade_total?: number | null }>,
): TcgResearchPopulationRow[] {
  return rows
    .map((row) => ({
      company: String(row.company ?? ""),
      grade: String(row.grade ?? ""),
      count: Number(row.count ?? 0),
      gradeTotal: row.grade_total == null ? null : Number(row.grade_total),
    }))
    .filter((row) => row.company && row.grade && row.count > 0)
    .sort((a, b) => b.count - a.count)
}

export async function resolveTcgResearchCardFull(input: {
  id?: string
  scrydexId?: string
  catalogId?: string
  game?: TcgGame
}): Promise<TcgResearchCardFull | null> {
  const catalogId =
    input.catalogId ??
    (input.scrydexId && input.game ? `${input.game}-${input.scrydexId}` : null) ??
    (input.id ? resolveCatalogId(input.id) : null)

  const detail = await resolveTcgResearchCard(input)
  if (!detail) return null

  let card = detailToMockEntry(detail)
  let population: TcgResearchPopulationRow[] = []
  let priceUpdatedAt = detail.priceUpdatedAt
  let priceSource: string | null = null

  if (catalogId && isScrydexConfigured()) {
    await ensureScrydexCardFresh(detail.id, { activity: "view" })
  }

  if (catalogId) {
    const bundle = await loadCardBundle(catalogId)
    if (bundle?.card) {
      const priceRow = scrydexBundleToCardPriceRow({
        card: bundle.card,
        raw: bundle.raw as never[],
        graded: bundle.graded as never[],
        legacyCardId: detail.id,
      })

      if (priceRow) {
        const fromBundle = cardPriceRowToMockEntry(priceRow, {
          id: card.id,
          cardName: bundle.card.name,
          setName: bundle.card.set_name,
          cardNumber: bundle.card.number,
          imageUrl: bundle.card.image_large_url ?? bundle.card.image_small_url ?? card.imageUrl,
          marketInsight: "Scrydex market prices, population, and sold listing history.",
        })
        card = mergeMockEntry(card, fromBundle)
        priceUpdatedAt = priceRow.synced_at ?? priceUpdatedAt
        priceSource = priceRow.price_source ?? "scrydex"
      }

      population = bundlePopulation(bundle.population as never[])
    }
  }

  if (!priceSource && (card.rawPrice > 0 || (card.gradeQuotes?.length ?? 0) > 0)) {
    priceSource = "local"
  }

  return {
    card,
    catalogId,
    scrydexId: detail.scrydexId,
    game: detail.game ?? splitCatalogId(catalogId ?? "")?.game ?? input.game ?? "pokemon",
    priceUpdatedAt,
    priceSource,
    population,
  }
}

export function tcgResearchSalesCard(full: TcgResearchCardFull) {
  return {
    id: full.card.id,
    cardName: full.card.cardName,
    setName: full.card.setName,
    cardNumber: full.card.cardNumber,
    searchQuery: undefined as string | undefined,
  }
}
