import {
  extractCardPrices,
  resolvePriceChartingForCard,
} from "@/lib/pricecharting"
import {
  extractTcgGoCardPrices,
  pokemonTcgIdFromCardId,
  resolveTcgGoCardForTarget,
} from "@/lib/tcggo-api"
import { buildCatalogPriceSearchQuery } from "@/lib/pricing/catalog-search-query"
import { getActivePriceProvider } from "@/lib/pricing/provider"
import { parseBinderCardNumber } from "@/lib/trade-binder/binder-prices"
import type { CardPriceTarget, FetchedCardPrices } from "@/lib/pricing/types"

const PC_RATE_LIMIT_MS = 1100
const TCGGO_RATE_LIMIT_MS = 2100

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function priceChartingIdFromCardId(cardId: string, explicit?: string): string | undefined {
  if (explicit?.trim()) return explicit.trim()
  if (cardId.startsWith("pc-")) return cardId.replace(/^pc-/, "")
  return undefined
}

export async function fetchCardPricesFromPriceCharting(
  apiKey: string,
  target: CardPriceTarget,
): Promise<FetchedCardPrices> {
  const priceChartingId = priceChartingIdFromCardId(target.cardId, target.priceChartingId)
  const cardNumber = target.cardNumber ?? parseBinderCardNumber(target.cardName, target.cardNumber)

  const { product } = await resolvePriceChartingForCard(apiKey, {
    cardName: target.cardName,
    setName: target.setName,
    cardNumber,
    priceChartingId,
  })

  const { rawPrice, grades } = extractCardPrices(product)
  const byGrade = new Map(grades.map((g) => [g.grade, g.price]))

  return {
    rawPrice,
    psa7Price: byGrade.get(7) ?? 0,
    psa8Price: byGrade.get(8) ?? 0,
    psa9Price: byGrade.get(9) ?? 0,
    psa10Price: byGrade.get(10) ?? 0,
    priceSource: "pricecharting",
  }
}

export async function fetchCardPricesFromTcgGo(target: CardPriceTarget): Promise<FetchedCardPrices> {
  const card = await resolveTcgGoCardForTarget({
    cardId: target.cardId,
    cardName: target.cardName,
    setName: target.setName,
    cardNumber: target.cardNumber,
    tcgGoId: target.tcgGoId,
  })

  if (!card) {
    throw new Error("Card not found in TCGGO API")
  }

  const extracted = extractTcgGoCardPrices(card)
  if (extracted.rawPrice <= 0 && extracted.psa10Price <= 0 && extracted.psa9Price <= 0) {
    throw new Error("No price returned from TCGGO API")
  }

  return {
    rawPrice: extracted.rawPrice,
    psa7Price: extracted.psa7Price,
    psa8Price: extracted.psa8Price,
    psa9Price: extracted.psa9Price,
    psa10Price: extracted.psa10Price,
    priceSource: "tcggo",
  }
}

export async function fetchCardPricesForTarget(target: CardPriceTarget): Promise<FetchedCardPrices> {
  const provider = getActivePriceProvider()
  if (provider === "tcggo") return fetchCardPricesFromTcgGo(target)
  if (provider === "pricecharting") {
    const apiKey = getPriceChartingApiKey()
    if (!apiKey) throw new Error("PRICECHARTING_API_KEY is not configured")
    return fetchCardPricesFromPriceCharting(apiKey, target)
  }
  throw new Error("No pricing provider configured")
}

export async function fetchCardPricesBatch(
  targets: CardPriceTarget[],
  options?: { rateLimitMs?: number; timeBudgetMs?: number; provider?: ReturnType<typeof getActivePriceProvider> },
): Promise<
  Array<{
    target: CardPriceTarget
    fetched: FetchedCardPrices | null
    syncError: string | null
  }>
> {
  const provider = options?.provider ?? getActivePriceProvider()
  const rateLimitMs =
    options?.rateLimitMs ?? (provider === "tcggo" ? TCGGO_RATE_LIMIT_MS : PC_RATE_LIMIT_MS)
  const timeBudgetMs = options?.timeBudgetMs
  const startedAt = Date.now()
  const results: Array<{
    target: CardPriceTarget
    fetched: FetchedCardPrices | null
    syncError: string | null
  }> = []

  if (!provider) {
    return targets.map((target) => ({
      target,
      fetched: null,
      syncError: "No pricing provider configured",
    }))
  }

  const apiKey = provider === "pricecharting" ? getPriceChartingApiKey() : undefined
  if (provider === "pricecharting" && !apiKey) {
    return targets.map((target) => ({
      target,
      fetched: null,
      syncError: "PRICECHARTING_API_KEY is not configured",
    }))
  }
  if (provider === "tcggo" && !getTcgGoApiKey()) {
    return targets.map((target) => ({
      target,
      fetched: null,
      syncError: "RAPIDAPI_POKEMON_TCG_KEY is not configured",
    }))
  }

  for (let i = 0; i < targets.length; i++) {
    if (timeBudgetMs != null && Date.now() - startedAt >= timeBudgetMs) {
      break
    }

    const target = targets[i]!
    try {
      const fetched =
        provider === "tcggo"
          ? await fetchCardPricesFromTcgGo(target)
          : await fetchCardPricesFromPriceCharting(apiKey!, target)
      results.push({ target, fetched, syncError: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Price fetch failed"
      results.push({ target, fetched: null, syncError: message })
    }

    if (i < targets.length - 1) {
      if (timeBudgetMs != null && Date.now() - startedAt + rateLimitMs >= timeBudgetMs) {
        break
      }
      await sleep(rateLimitMs)
    }
  }

  return results
}
