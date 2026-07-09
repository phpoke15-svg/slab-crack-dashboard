import { revalidateTag } from "next/cache"
import {
  listDistinctBinderCards,
  listStaleBinderCardIds,
  upsertBinderCardPrices,
  type BinderPriceTarget,
} from "@/lib/db/binder-card-prices"
import { attachBinderCardPrices } from "@/lib/trade-binder/binder-prices"
import { fetchPopularBinderCardsUncached } from "@/lib/trade-binder/popular-binder-cards"

export type SyncBinderPricesResult = {
  syncedAt: string
  candidates: number
  refreshed: number
  skipped: number
  source: "pricecharting" | "skipped"
}

const DEFAULT_MAX_CARDS = 250
const BATCH_SIZE = 20
const BATCH_CONCURRENCY = 2

function mergeTargets(
  binderCards: BinderPriceTarget[],
  popularCards: Awaited<ReturnType<typeof fetchPopularBinderCardsUncached>>,
): BinderPriceTarget[] {
  const byId = new Map<string, BinderPriceTarget>()

  for (const card of binderCards) {
    byId.set(card.id, card)
  }

  for (const card of popularCards) {
    if (byId.has(card.id)) continue
    byId.set(card.id, {
      id: card.id,
      name: card.name,
      set: card.set,
      cardNumber: card.cardNumber,
    })
  }

  return [...byId.values()]
}

export async function syncBinderCardPrices(options?: {
  maxCards?: number
  force?: boolean
}): Promise<SyncBinderPricesResult> {
  const apiKey = process.env.PRICECHARTING_API_KEY
  const maxCards = options?.maxCards ?? DEFAULT_MAX_CARDS
  const syncedAt = new Date().toISOString()

  if (!apiKey) {
    return {
      syncedAt,
      candidates: 0,
      refreshed: 0,
      skipped: 0,
      source: "skipped",
    }
  }

  const [binderCards, popularCards] = await Promise.all([
    listDistinctBinderCards(),
    fetchPopularBinderCardsUncached(30),
  ])

  const targets = mergeTargets(binderCards, popularCards)
  const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const staleIds = options?.force
    ? new Set(targets.map((card) => card.id))
    : await listStaleBinderCardIds(
        targets.map((card) => card.id),
        staleBefore,
      )

  const toSync = targets.filter((card) => staleIds.has(card.id)).slice(0, maxCards)

  if (toSync.length === 0) {
    revalidateTag("popular-binder-cards")
    return {
      syncedAt,
      candidates: targets.length,
      refreshed: 0,
      skipped: targets.length,
      source: "pricecharting",
    }
  }

  let refreshed = 0

  for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
    const batch = toSync.slice(i, i + BATCH_SIZE)
    const prices = await attachBinderCardPrices(batch, {
      limit: batch.length,
      concurrency: BATCH_CONCURRENCY,
    })

    const rows = batch
      .map((card) => {
        const rawPrice = prices.get(card.id) ?? 0
        if (rawPrice <= 0) return null
        return {
          cardId: card.id,
          rawPrice,
          cardName: card.name,
          cardSet: card.set,
          cardNumber: card.cardNumber,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    refreshed += await upsertBinderCardPrices(rows)
  }

  revalidateTag("popular-binder-cards")

  return {
    syncedAt,
    candidates: targets.length,
    refreshed,
    skipped: Math.max(0, targets.length - toSync.length),
    source: "pricecharting",
  }
}
