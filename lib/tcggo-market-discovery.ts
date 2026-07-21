import {
  catalogIdFromTcgGoCard,
  extractTcgGoCardPrices,
  fetchTcgGoCatalogPage,
  tcgGoCardImageUrl,
  tcgGoCardNumber,
  tcgGoCardSetName,
  type TcgGoCard,
} from "@/lib/tcggo-api"
import { isMainlinePokemonTcg, isRecentSetRelease } from "@/lib/pokemon-tcg-filter"
import {
  buildGradeQuotesFromPrices,
  getBestGradeQuote,
  type MockCardEntry,
} from "@/lib/slab-data"

export type TcgGoMarketRow = {
  catalogId: string
  tcgGoId?: number
  tcgId?: string
  productName: string
  setName: string
  cardNumber: string
  rawPrice: number
  psa7: number
  psa8: number
  psa9: number
  psa10: number
  imageUrl?: string
}

export type TcgGoArbitrageCandidate = TcgGoMarketRow & {
  slabGrade: number
  slabPrice: number
  deficit: number
  percentageSavings: number
}

export const DISCOVERY_MARKET_INSIGHT =
  "Auto-discovered from pokemon-api catalog scan — graded copy cheaper than TCGPlayer raw market."

export function tcgGoCardToMarketRow(card: TcgGoCard): TcgGoMarketRow | null {
  const prices = extractTcgGoCardPrices(card)
  if (prices.rawPrice <= 0) return null

  const setName = tcgGoCardSetName(card)
  const productName = card.name?.trim() || card.name_numbered?.trim() || "Unknown card"
  if (!isMainlinePokemonTcg({ setName, productName })) return null

  return {
    catalogId: catalogIdFromTcgGoCard(card),
    tcgGoId: card.id,
    tcgId: card.tcgid,
    productName,
    setName,
    cardNumber: tcgGoCardNumber(card),
    rawPrice: prices.rawPrice,
    psa7: prices.psa7Price,
    psa8: prices.psa8Price,
    psa9: prices.psa9Price,
    psa10: prices.psa10Price,
    imageUrl: tcgGoCardImageUrl(card) ?? undefined,
  }
}

export function rowToTcgGoArbitrage(row: TcgGoMarketRow): TcgGoArbitrageCandidate | null {
  const grades = [
    { grade: 7, price: row.psa7 },
    { grade: 8, price: row.psa8 },
    { grade: 9, price: row.psa9 },
    { grade: 10, price: row.psa10 },
  ].filter((g) => g.price > 0)

  if (grades.length === 0 || row.rawPrice <= 0) return null

  let best: TcgGoArbitrageCandidate | null = null
  for (const { grade, price } of grades) {
    if (price >= row.rawPrice) continue
    const deficit = row.rawPrice - price
    const percentageSavings = Math.round((deficit / row.rawPrice) * 100)
    if (!best || deficit > best.deficit) {
      best = {
        ...row,
        slabGrade: grade,
        slabPrice: price,
        deficit,
        percentageSavings,
      }
    }
  }

  return best
}

export function findTcgGoArbitrageCandidates(
  rows: TcgGoMarketRow[],
  options?: { minRawPrice?: number; minDeficit?: number; maxRawPrice?: number },
): TcgGoArbitrageCandidate[] {
  const minRaw = options?.minRawPrice ?? 15
  const minDeficit = options?.minDeficit ?? 5
  const maxRaw = options?.maxRawPrice ?? Number(process.env.DISCOVERY_MAX_RAW_PRICE ?? 5000)

  return rows
    .filter((row) => row.rawPrice >= minRaw && row.rawPrice <= maxRaw)
    .filter((row) => isRecentSetRelease(undefined))
    .map(rowToTcgGoArbitrage)
    .filter((row): row is TcgGoArbitrageCandidate => row !== null && row.deficit >= minDeficit)
    .sort((a, b) => b.deficit - a.deficit)
}

export function candidateToAnomalyEntry(candidate: TcgGoArbitrageCandidate): MockCardEntry {
  const gradeQuotes = buildGradeQuotesFromPrices(candidate.rawPrice, [
    { grade: 7, price: candidate.psa7 },
    { grade: 8, price: candidate.psa8 },
    { grade: 9, price: candidate.psa9 },
    { grade: 10, price: candidate.psa10 },
  ])
  const best = getBestGradeQuote(gradeQuotes)

  return {
    id: candidate.catalogId,
    pokemonTcgId: candidate.tcgId ? candidate.tcgId.replace(/^poke-/, "") : undefined,
    cardName: candidate.productName,
    setName: candidate.setName,
    cardNumber: candidate.cardNumber,
    imageUrl: candidate.imageUrl ?? "https://placehold.co/150x210",
    rawPrice: candidate.rawPrice,
    slabGrade: best?.grade ?? candidate.slabGrade,
    slabPrice: best?.slabPrice ?? candidate.slabPrice,
    deficit: best?.deficit ?? candidate.deficit,
    percentageSavings: best?.percentageSavings ?? candidate.percentageSavings,
    gradeQuotes,
    marketInsight: DISCOVERY_MARKET_INSIGHT,
    hasPricing: true,
  }
}

export async function fetchTcgGoCatalogBatch(
  startPage: number,
  pagesPerRun: number,
  perPage = 50,
): Promise<{ rows: TcgGoMarketRow[]; startPage: number; endPage: number; totalPages: number }> {
  const rows: TcgGoMarketRow[] = []
  let totalPages = 1
  let page = Math.max(1, startPage)

  for (let i = 0; i < pagesPerRun; i += 1) {
    const result = await fetchTcgGoCatalogPage(page, perPage)
    totalPages = Math.max(1, Math.ceil(result.totalCount / Math.max(result.pageSize, 1)))

    for (const card of result.cards) {
      const row = tcgGoCardToMarketRow(card)
      if (row) rows.push(row)
    }

    if (page >= totalPages || result.cards.length === 0) {
      page = 1
      break
    }

    page += 1
    await new Promise((resolve) => setTimeout(resolve, 400))
  }

  const endPage = page >= totalPages ? 1 : page
  return { rows, startPage, endPage, totalPages }
}
