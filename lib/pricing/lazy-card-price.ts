import { getCardPriceById, upsertCardPricesSafe } from "@/lib/pricing/db"
import { fetchCardPricesForTarget } from "@/lib/pricing/fetch"
import { getActivePriceProvider, isCachedPriceFromActiveProvider } from "@/lib/pricing/provider"
import type { CatalogSearchHit } from "@/lib/db/cards-catalog"
import { promoCardMeta } from "@/lib/trade-binder/promo-card-meta"

const PRICE_TTL_MS = 24 * 60 * 60 * 1000

export type LazyCardPriceResult = {
  cardId: string
  rawPrice: number | null
  psa7Price: number | null
  psa8Price: number | null
  psa9Price: number | null
  psa10Price: number | null
  source: "cache" | "pricecharting" | "tcggo" | "unavailable" | "skipped"
  syncedAt: string
  unavailableUntil?: string
}

function isFresh(syncedAt: string | null | undefined, syncError: string | null | undefined): boolean {
  if (!syncedAt) return false
  const age = Date.now() - new Date(syncedAt).getTime()
  if (age > PRICE_TTL_MS) return false
  if (syncError === "unavailable") return true
  return true
}

function hasUsablePrice(cached: Awaited<ReturnType<typeof getCardPriceById>>): boolean {
  if (!cached || cached.sync_error === "unavailable") return false
  return (
    (cached.raw_price ?? 0) > 0 ||
    (cached.psa7_price ?? 0) > 0 ||
    (cached.psa8_price ?? 0) > 0 ||
    (cached.psa9_price ?? 0) > 0 ||
    (cached.psa10_price ?? 0) > 0
  )
}

function cachedSourceLabel(
  cached: NonNullable<Awaited<ReturnType<typeof getCardPriceById>>>,
): LazyCardPriceResult["source"] {
  const source = (cached.price_source ?? "pricecharting").trim().toLowerCase()
  if (source === "tcggo") return "tcggo"
  if (source === "pricecharting") return "pricecharting"
  return "cache"
}

function cachedToResult(cardId: string, cached: NonNullable<Awaited<ReturnType<typeof getCardPriceById>>>): LazyCardPriceResult {
  if (cached.sync_error === "unavailable") {
    return {
      cardId,
      rawPrice: null,
      psa7Price: null,
      psa8Price: null,
      psa9Price: null,
      psa10Price: null,
      source: "unavailable",
      syncedAt: cached.synced_at,
      unavailableUntil: new Date(new Date(cached.synced_at).getTime() + PRICE_TTL_MS).toISOString(),
    }
  }

  return {
    cardId,
    rawPrice: cached.raw_price,
    psa7Price: cached.psa7_price,
    psa8Price: cached.psa8_price,
    psa9Price: cached.psa9_price,
    psa10Price: cached.psa10_price,
    source: cachedSourceLabel(cached),
    syncedAt: cached.synced_at,
  }
}

export async function getLazyCardPrice(card: CatalogSearchHit): Promise<LazyCardPriceResult> {
  const syncedAt = new Date().toISOString()
  const cached = await getCardPriceById(card.id)
  const provider = getActivePriceProvider()

  if (
    cached &&
    isFresh(cached.synced_at, cached.sync_error) &&
    hasUsablePrice(cached) &&
    isCachedPriceFromActiveProvider(cached, provider)
  ) {
    return cachedToResult(card.id, cached)
  }
  if (!provider) {
    return {
      cardId: card.id,
      rawPrice: cached?.raw_price ?? null,
      psa7Price: cached?.psa7_price ?? null,
      psa8Price: cached?.psa8_price ?? null,
      psa9Price: cached?.psa9_price ?? null,
      psa10Price: cached?.psa10_price ?? null,
      source: "skipped",
      syncedAt: cached?.synced_at ?? syncedAt,
    }
  }

  try {
    const meta = promoCardMeta(card.id)
    const fetched = await fetchCardPricesForTarget({
      cardId: card.id,
      cardName: card.name,
      setName: card.setName,
      cardNumber: card.number,
      tcgGoId: meta?.tcgGoId,
      tcgplayerId: meta?.tcgplayerId,
    })

    if ((fetched.rawPrice ?? 0) <= 0 && fetched.psa10Price <= 0) {
      throw new Error("No price returned")
    }

    await upsertCardPricesSafe([
      {
        target: {
          cardId: card.id,
          cardName: card.name,
          setName: card.setName,
          cardNumber: card.number,
        },
        fetched,
        syncError: null,
      },
    ])

    return {
      cardId: card.id,
      rawPrice: fetched.rawPrice,
      psa7Price: fetched.psa7Price,
      psa8Price: fetched.psa8Price,
      psa9Price: fetched.psa9Price,
      psa10Price: fetched.psa10Price,
      source: provider,
      syncedAt,
    }
  } catch {
    await upsertCardPricesSafe([
      {
        target: {
          cardId: card.id,
          cardName: card.name,
          setName: card.setName,
          cardNumber: card.number,
        },
        fetched: null,
        syncError: "unavailable",
      },
    ])

    return {
      cardId: card.id,
      rawPrice: null,
      psa7Price: null,
      psa8Price: null,
      psa9Price: null,
      psa10Price: null,
      source: "unavailable",
      syncedAt,
      unavailableUntil: new Date(Date.now() + PRICE_TTL_MS).toISOString(),
    }
  }
}
