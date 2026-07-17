import { listDistinctBinderCards } from "@/lib/db/binder-card-prices"
import { upsertBinderCardPrices } from "@/lib/db/binder-card-prices"
import { getWatchlistFromDb } from "@/lib/db/watchlist"
import { fetchPopularBinderCardsUncached } from "@/lib/trade-binder/popular-binder-cards"
import { fetchCardPricesBatch } from "@/lib/pricing/fetch"
import {
  appendPriceHistory,
  listStaleCardPriceIds,
  upsertCardPricesSafe,
} from "@/lib/pricing/db"
import type { CardPriceTarget, PriceHistoryPoint, SyncCardPricesResult } from "@/lib/pricing/types"

/** Vercel maxDuration is 300s — stay under with margin for DB writes. */
const DEFAULT_TIME_BUDGET_MS = 260_000
const DEFAULT_MAX_CARDS = 220
const STALE_HOURS = 24

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.round(parsed)
}

function mergeTargets(...groups: CardPriceTarget[][]): CardPriceTarget[] {
  const byId = new Map<string, CardPriceTarget>()
  for (const group of groups) {
    for (const target of group) {
      if (!target.cardId?.trim()) continue
      const existing = byId.get(target.cardId)
      if (!existing) {
        byId.set(target.cardId, target)
        continue
      }
      byId.set(target.cardId, {
        ...existing,
        cardName: existing.cardName || target.cardName,
        setName: existing.setName || target.setName,
        cardNumber: existing.cardNumber || target.cardNumber,
        priceChartingId: existing.priceChartingId || target.priceChartingId,
      })
    }
  }
  return [...byId.values()]
}

async function collectSyncTargets(): Promise<CardPriceTarget[]> {
  const [binderCards, watchlist, popularCards] = await Promise.all([
    listDistinctBinderCards().catch(() => [] as CardPriceTarget[]),
    getWatchlistFromDb().catch(() => []),
    fetchPopularBinderCardsUncached(40).catch(() => []),
  ])

  const watchlistTargets: CardPriceTarget[] = watchlist.map((card) => ({
    cardId: card.id.startsWith("pc-") || card.id.startsWith("poke-")
      ? card.id
      : card.priceChartingId
        ? `pc-${card.priceChartingId}`
        : `poke-${card.pokemonTcgId ?? card.id}`,
    cardName: card.cardName,
    setName: card.setName,
    cardNumber: card.cardNumber,
    priceChartingId: card.priceChartingId,
  }))

  const popularTargets: CardPriceTarget[] = popularCards.map((card) => ({
    cardId: card.id,
    cardName: card.name,
    setName: card.set,
    cardNumber: card.cardNumber,
    priceChartingId: card.id.startsWith("pc-") ? card.id.replace(/^pc-/, "") : undefined,
  }))

  return mergeTargets(binderCards, watchlistTargets, popularTargets)
}

function historyPointsFromFetch(
  target: CardPriceTarget,
  fetched: { rawPrice: number; psa7Price: number; psa8Price: number; psa9Price: number; psa10Price: number },
  snapshotDate: string,
): PriceHistoryPoint[] {
  const points: PriceHistoryPoint[] = []
  const grades: Array<{ grade: number; price: number }> = [
    { grade: 0, price: fetched.rawPrice },
    { grade: 7, price: fetched.psa7Price },
    { grade: 8, price: fetched.psa8Price },
    { grade: 9, price: fetched.psa9Price },
    { grade: 10, price: fetched.psa10Price },
  ]

  for (const { grade, price } of grades) {
    if (price > 0) {
      points.push({
        cardId: target.cardId,
        snapshotDate,
        grade,
        price,
        source: "snapshot",
      })
    }
  }

  return points
}

export async function syncUnifiedCardPrices(options?: {
  maxCards?: number
  force?: boolean
  timeBudgetMs?: number
}): Promise<SyncCardPricesResult> {
  const apiKey = process.env.PRICECHARTING_API_KEY
  const syncedAt = new Date().toISOString()
  const snapshotDate = syncedAt.slice(0, 10)
  const maxCards =
    options?.maxCards ??
    parsePositiveInt(process.env.PRICE_SYNC_MAX_CARDS, DEFAULT_MAX_CARDS)
  const timeBudgetMs =
    options?.timeBudgetMs ??
    parsePositiveInt(process.env.PRICE_SYNC_TIME_BUDGET_MS, DEFAULT_TIME_BUDGET_MS)

  if (!apiKey) {
    return {
      syncedAt,
      candidates: 0,
      refreshed: 0,
      skipped: 0,
      failed: 0,
      processed: 0,
      remaining: 0,
      stoppedEarly: false,
      errors: ["PRICECHARTING_API_KEY is not configured"],
      source: "skipped",
    }
  }

  const targets = await collectSyncTargets()
  const staleBefore = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString()
  const staleIds = options?.force
    ? new Set(targets.map((t) => t.cardId))
    : await listStaleCardPriceIds(
        targets.map((t) => t.cardId),
        staleBefore,
      )

  const staleTargets = targets.filter((t) => staleIds.has(t.cardId))
  const toSync = staleTargets.slice(0, maxCards)

  if (toSync.length === 0) {
    return {
      syncedAt,
      candidates: targets.length,
      refreshed: 0,
      skipped: targets.length,
      failed: 0,
      processed: 0,
      remaining: 0,
      stoppedEarly: false,
      errors: [],
      source: "pricecharting",
    }
  }

  const batchResults = await fetchCardPricesBatch(apiKey, toSync, { timeBudgetMs })
  const processed = batchResults.length
  const stoppedEarly = processed < toSync.length
  const remaining = Math.max(0, staleTargets.length - processed)
  const refreshed = await upsertCardPricesSafe(batchResults)

  const historyPoints: PriceHistoryPoint[] = []
  const binderRows: Array<{
    cardId: string
    rawPrice: number
    cardName: string
    cardSet: string
    cardNumber?: string
  }> = []

  let failed = 0
  const errors: string[] = []

  for (const result of batchResults) {
    if (result.syncError) {
      failed++
      if (errors.length < 20) {
        errors.push(`${result.target.cardId}: ${result.syncError}`)
      }
      continue
    }
    if (!result.fetched) continue

    historyPoints.push(...historyPointsFromFetch(result.target, result.fetched, snapshotDate))

    if (result.fetched.rawPrice > 0) {
      binderRows.push({
        cardId: result.target.cardId,
        rawPrice: result.fetched.rawPrice,
        cardName: result.target.cardName,
        cardSet: result.target.setName,
        cardNumber: result.target.cardNumber,
      })
    }
  }

  await appendPriceHistory(historyPoints).catch((error) => {
    console.warn("[pricing/sync] price_history append failed:", error)
  })

  await upsertBinderCardPrices(binderRows).catch((error) => {
    console.warn("[pricing/sync] binder_card_prices dual-write failed:", error)
  })

  return {
    syncedAt,
    candidates: targets.length,
    refreshed,
    skipped: Math.max(0, targets.length - staleTargets.length),
    failed,
    processed,
    remaining,
    stoppedEarly,
    errors,
    source: "pricecharting",
  }
}
