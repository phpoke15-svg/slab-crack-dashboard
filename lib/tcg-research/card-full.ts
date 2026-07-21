import { cardPriceRowToMockEntry } from "@/lib/pricing/views"
import { ensureCardDailyPriceHistory } from "@/lib/pricing/card-daily-price-history"
import { ensureScrydexCardFresh } from "@/lib/scrydex/on-demand"
import { isScrydexConfigured } from "@/lib/scrydex/constants"
import { loadCardBundle } from "@/lib/scrydex/db"
import { upsertCatalogBundleDailyHistory } from "@/lib/scrydex/webhook-history"
import { resolveScanToCatalog, ScrydexVisionNoMatchError, visionScanGameScope } from "@/lib/scrydex/vision-pipeline"
import { scrydexBundleToCardPriceRow } from "@/lib/scrydex/price-adapter"
import { resolveCatalogId, splitCatalogId } from "@/lib/scrydex/constants"
import type { CardPriceBundle, TcgGame } from "@/lib/scrydex/types"
import {
  buildGradeQuotes,
  normalizeCardEntry,
  type MockCardEntry,
  type RecentSale,
} from "@/lib/slab-data"
import {
  gradedRowsFromScrydexBundle,
  mergeGradedPriceRows,
  gradedPricesFromMockCard,
  type ScrydexGradedPrice,
} from "@/lib/grading/quotes"
import { catalogBundleToDetail, resolveTcgResearchCard, type TcgResearchCardDetail } from "@/lib/tcg-research/card-detail"

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
  priceTrend: TcgResearchCardDetail["priceTrend"]
  population: TcgResearchPopulationRow[]
  gradedPrices: ScrydexGradedPrice[]
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

function finalizeGradedPrices(
  bundleGraded: ScrydexGradedPrice[],
  card: MockCardEntry,
): ScrydexGradedPrice[] {
  return mergeGradedPriceRows(bundleGraded, gradedPricesFromMockCard(card))
}

function trendFromDetail(detail: TcgResearchCardDetail, card: MockCardEntry): TcgResearchCardDetail["priceTrend"] {
  if (detail.priceTrend) return detail.priceTrend
  const psa10 = card.gradeQuotes?.find((quote) => quote.grade === 10)?.slabPrice ?? card.slabPrice
  if (!psa10 || psa10 <= 0 || card.rawPrice <= 0) return null
  const spread = psa10 - card.rawPrice
  if (spread > card.rawPrice * 0.15) return "up"
  if (spread < card.rawPrice * 0.05) return "down"
  return "flat"
}

/** Build a TCG Research panel payload directly from a Scrydex vision/catalog bundle. */
export function tcgResearchCardFullFromBundle(bundle: CardPriceBundle): TcgResearchCardFull {
  const detail = catalogBundleToDetail(bundle)
  if (!detail) throw new ScrydexVisionNoMatchError("Vision match could not be loaded")

  let card = detailToMockEntry(detail)
  let priceUpdatedAt = detail.priceUpdatedAt
  let priceSource: string | null = "scrydex"

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
  }

  const gradedPrices = finalizeGradedPrices(gradedRowsFromScrydexBundle(bundle.graded as never[]), card)

  return {
    card,
    catalogId: bundle.card.catalog_id,
    scrydexId: bundle.card.scrydex_id,
    game: bundle.card.game,
    priceUpdatedAt,
    priceSource,
    priceTrend: trendFromDetail(detail, card),
    population: bundlePopulation(bundle.population as never[]),
    gradedPrices,
  }
}

/** Scrydex Vision identify → full TCG Research card payload (Pokémon, Lorcana, MTG). */
export async function scanTcgResearchCardFromVision(input: {
  imageBase64: string
  preferredGame?: TcgGame
}): Promise<TcgResearchCardFull> {
  const preferred = input.preferredGame ?? "pokemon"
  const bundle = await resolveScanToCatalog({
    imageBase64: input.imageBase64,
    preferredGames: visionScanGameScope(preferred),
  })
  return tcgResearchCardFullFromBundle(bundle)
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
  let gradedPrices: ScrydexGradedPrice[] = []
  let priceUpdatedAt = detail.priceUpdatedAt
  let priceSource: string | null = null
  let priceTrend = detail.priceTrend

  if (catalogId && isScrydexConfigured()) {
    await ensureScrydexCardFresh(detail.id, { activity: "view" })
    await ensureCardDailyPriceHistory(detail.id).catch((error) => {
      console.warn("[tcg-research/card-full] history backfill failed:", error)
    })
  }

  let resolvedScrydexId = detail.scrydexId
  let resolvedGame = detail.game ?? splitCatalogId(catalogId ?? "")?.game ?? input.game ?? "pokemon"

  if (catalogId) {
    const bundle = await loadCardBundle(catalogId)
    if (bundle?.card) {
      resolvedScrydexId = bundle.card.scrydex_id ?? resolvedScrydexId
      resolvedGame = bundle.card.game ?? resolvedGame

      try {
        await upsertCatalogBundleDailyHistory({
          catalogId,
          raw: bundle.raw as never[],
          graded: bundle.graded as never[],
        })
      } catch (error) {
        console.warn("[tcg-research/card-full] daily history snapshot failed:", catalogId, error)
      }

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
      gradedPrices = finalizeGradedPrices(gradedRowsFromScrydexBundle(bundle.graded as never[]), card)
    }
  }

  priceTrend = trendFromDetail({ ...detail, priceTrend }, card)

  if (!priceSource && (card.rawPrice > 0 || (card.gradeQuotes?.length ?? 0) > 0)) {
    priceSource = "local"
  }

  return {
    card,
    catalogId,
    scrydexId: resolvedScrydexId,
    game: resolvedGame,
    priceUpdatedAt,
    priceSource,
    priceTrend,
    population,
    gradedPrices,
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
