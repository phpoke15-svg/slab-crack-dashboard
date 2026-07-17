import { getCardPriceById, upsertCardPricesSafe } from "@/lib/pricing/db"
import { resolveBinderCardPrice } from "@/lib/trade-binder/binder-prices"
import type { CatalogSearchHit } from "@/lib/db/cards-catalog"

const PRICE_TTL_MS = 24 * 60 * 60 * 1000

export type LazyCardPriceResult = {
  cardId: string
  rawPrice: number | null
  psa10Price: number | null
  source: "cache" | "pricecharting" | "unavailable" | "skipped"
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

export async function getLazyCardPrice(card: CatalogSearchHit): Promise<LazyCardPriceResult> {
  const syncedAt = new Date().toISOString()
  const cached = await getCardPriceById(card.id)

  if (cached && isFresh(cached.synced_at, cached.sync_error)) {
    if (cached.sync_error === "unavailable") {
      return {
        cardId: card.id,
        rawPrice: null,
        psa10Price: null,
        source: "unavailable",
        syncedAt: cached.synced_at,
        unavailableUntil: new Date(new Date(cached.synced_at).getTime() + PRICE_TTL_MS).toISOString(),
      }
    }

    if ((cached.raw_price ?? 0) > 0) {
      return {
        cardId: card.id,
        rawPrice: cached.raw_price,
        psa10Price: cached.psa10_price,
        source: "cache",
        syncedAt: cached.synced_at,
      }
    }
  }

  const apiKey = process.env.PRICECHARTING_API_KEY
  if (!apiKey) {
    return {
      cardId: card.id,
      rawPrice: null,
      psa10Price: null,
      source: "skipped",
      syncedAt,
    }
  }

  const rawPrice = await resolveBinderCardPrice(
    apiKey,
    {
      id: card.id,
      name: card.name,
      set: card.setName,
      cardNumber: card.number,
    },
    cached?.raw_price ?? undefined,
  )

  if (rawPrice <= 0) {
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
      psa10Price: null,
      source: "unavailable",
      syncedAt,
      unavailableUntil: new Date(Date.now() + PRICE_TTL_MS).toISOString(),
    }
  }

  await upsertCardPricesSafe([
    {
      target: {
        cardId: card.id,
        cardName: card.name,
        setName: card.setName,
        cardNumber: card.number,
      },
      fetched: {
        rawPrice,
        psa7Price: 0,
        psa8Price: 0,
        psa9Price: 0,
        psa10Price: 0,
        priceSource: "pricecharting",
      },
      syncError: null,
    },
  ])

  return {
    cardId: card.id,
    rawPrice,
    psa10Price: null,
    source: "pricecharting",
    syncedAt,
  }
}
