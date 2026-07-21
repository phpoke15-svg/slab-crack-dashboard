import {
  extractTcgGoCardPrices,
  fetchLatestTcgGoRawMarketPrice,
  pokemonTcgIdFromCardId,
  resolveTcgGoCardForTarget,
  tcgGoCardMatchesTarget,
} from "@/lib/tcggo-api"
import { getActivePriceProvider, getTcgGoApiKey } from "@/lib/pricing/provider"
import type { CardPriceTarget, FetchedCardPrices } from "@/lib/pricing/types"

const TCGGO_RATE_LIMIT_MS = 2100

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchCardPricesFromTcgGo(target: CardPriceTarget): Promise<FetchedCardPrices> {
  const card = await resolveTcgGoCardForTarget({
    cardId: target.cardId,
    cardName: target.cardName,
    setName: target.setName,
    cardNumber: target.cardNumber,
    tcgGoId: target.tcgGoId,
    tcgplayerId: target.tcgplayerId,
  })

  if (!card) {
    throw new Error("Card not found in pokemon-api")
  }

  if (!tcgGoCardMatchesTarget(card, { cardName: target.cardName, cardNumber: target.cardNumber })) {
    throw new Error("pokemon-api returned a different card than requested")
  }

  const extracted = extractTcgGoCardPrices(card)
  let rawPrice = extracted.rawPrice
  if (rawPrice <= 0) {
    rawPrice = await fetchLatestTcgGoRawMarketPrice({
      tcgGoId: card.id ?? target.tcgGoId,
      tcgId: card.tcgid ?? pokemonTcgIdFromCardId(target.cardId),
    })
  }

  if (rawPrice <= 0 && extracted.psa10Price <= 0 && extracted.psa9Price <= 0) {
    throw new Error("No USD price returned from pokemon-api")
  }

  return {
    rawPrice,
    psa7Price: extracted.psa7Price,
    psa8Price: extracted.psa8Price,
    psa9Price: extracted.psa9Price,
    psa10Price: extracted.psa10Price,
    priceSource: "tcggo",
    tcgGoId: card.id ?? target.tcgGoId,
    tcgplayerId: card.tcgplayer_id ?? target.tcgplayerId,
    tcgId: card.tcgid ?? pokemonTcgIdFromCardId(target.cardId),
    language: target.language,
  }
}

/** Fetch live USD prices from pokemon-api.com (TCGPlayer raw + eBay PSA medians). */
export async function fetchCardPricesForTarget(target: CardPriceTarget): Promise<FetchedCardPrices> {
  if (getActivePriceProvider() !== "tcggo") {
    throw new Error("RAPIDAPI_POKEMON_TCG_KEY is not configured")
  }
  return fetchCardPricesFromTcgGo(target)
}

export async function fetchCardPricesBatch(
  targets: CardPriceTarget[],
  options?: { rateLimitMs?: number; timeBudgetMs?: number },
): Promise<
  Array<{
    target: CardPriceTarget
    fetched: FetchedCardPrices | null
    syncError: string | null
  }>
> {
  const rateLimitMs = options?.rateLimitMs ?? TCGGO_RATE_LIMIT_MS
  const timeBudgetMs = options?.timeBudgetMs
  const startedAt = Date.now()
  const results: Array<{
    target: CardPriceTarget
    fetched: FetchedCardPrices | null
    syncError: string | null
  }> = []

  if (getActivePriceProvider() !== "tcggo" || !getTcgGoApiKey()) {
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
      const fetched = await fetchCardPricesFromTcgGo(target)
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
