import {
  extractCardPrices,
  resolvePriceChartingForCard,
} from "@/lib/pricecharting"
import { buildCatalogPriceSearchQuery } from "@/lib/pricing/catalog-search-query"
import { parseBinderCardNumber } from "@/lib/trade-binder/binder-prices"
import type { CardPriceTarget, FetchedCardPrices } from "@/lib/pricing/types"

const PC_RATE_LIMIT_MS = 1100

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

export async function fetchCardPricesBatch(
  apiKey: string,
  targets: CardPriceTarget[],
  options?: { rateLimitMs?: number; timeBudgetMs?: number },
): Promise<
  Array<{
    target: CardPriceTarget
    fetched: FetchedCardPrices | null
    syncError: string | null
  }>
> {
  const rateLimitMs = options?.rateLimitMs ?? PC_RATE_LIMIT_MS
  const timeBudgetMs = options?.timeBudgetMs
  const startedAt = Date.now()
  const results: Array<{
    target: CardPriceTarget
    fetched: FetchedCardPrices | null
    syncError: string | null
  }> = []

  for (let i = 0; i < targets.length; i++) {
    if (timeBudgetMs != null && Date.now() - startedAt >= timeBudgetMs) {
      break
    }

    const target = targets[i]!
    try {
      const fetched = await fetchCardPricesFromPriceCharting(apiKey, target)
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
