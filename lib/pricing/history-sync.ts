import { appendPriceHistory } from "@/lib/pricing/db"
import { fetchCardPricesBatch } from "@/lib/pricing/fetch"
import { getActivePriceProvider } from "@/lib/pricing/provider"
import type { CardPriceTarget, PriceHistoryPoint } from "@/lib/pricing/types"
import {
  fetchAllTcgGoHistoryPrices,
  pokemonTcgIdFromCardId,
  resolveTcgGoCardForTarget,
} from "@/lib/tcggo-api"
import { collectSyncTargets } from "@/lib/pricing/sync"

const DEFAULT_HISTORY_DAYS = 30
const DEFAULT_MAX_CARDS = 40
const DEFAULT_TIME_BUDGET_MS = 240_000

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return formatDate(date)
}

export type SyncPriceHistoryResult = {
  syncedAt: string
  provider: "tcggo" | "skipped"
  candidates: number
  processed: number
  historyPoints: number
  failed: number
  errors: string[]
  stoppedEarly: boolean
}

async function historyPointsForTarget(
  target: CardPriceTarget,
  days: number,
): Promise<PriceHistoryPoint[]> {
  const tcgId = pokemonTcgIdFromCardId(target.cardId)
  const card = await resolveTcgGoCardForTarget({
    cardId: target.cardId,
    cardName: target.cardName,
    setName: target.setName,
    cardNumber: target.cardNumber,
    tcgGoId: target.tcgGoId,
  })

  const history = await fetchAllTcgGoHistoryPrices({
    tcgGoId: card?.id ?? target.tcgGoId,
    tcgId: card?.tcgid ?? tcgId,
    cardmarketId: card?.cardmarket_id,
    dateFrom: daysAgo(days),
    dateTo: formatDate(new Date()),
    maxPages: 8,
  })

  return history.map((point) => ({
    cardId: target.cardId,
    snapshotDate: point.date,
    grade: point.grade,
    price: point.price,
    saleCount: point.saleCount,
    source: "tcggo",
  }))
}

export async function syncTcgGoPriceHistory(options?: {
  maxCards?: number
  days?: number
  timeBudgetMs?: number
  targets?: CardPriceTarget[]
}): Promise<SyncPriceHistoryResult> {
  const syncedAt = new Date().toISOString()
  const provider = getActivePriceProvider()
  const days = options?.days ?? DEFAULT_HISTORY_DAYS
  const maxCards = options?.maxCards ?? DEFAULT_MAX_CARDS
  const timeBudgetMs = options?.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS
  const startedAt = Date.now()

  if (provider !== "tcggo") {
    return {
      syncedAt,
      provider: "skipped",
      candidates: 0,
      processed: 0,
      historyPoints: 0,
      failed: 0,
      errors: ["TCGGO price history sync requires RAPIDAPI_POKEMON_TCG_KEY"],
      stoppedEarly: false,
    }
  }

  const targets = (options?.targets ?? (await collectSyncTargets())).slice(0, maxCards)
  const allPoints: PriceHistoryPoint[] = []
  const errors: string[] = []
  let processed = 0
  let failed = 0
  let stoppedEarly = false

  for (const target of targets) {
    if (Date.now() - startedAt >= timeBudgetMs) {
      stoppedEarly = true
      break
    }

    try {
      const points = await historyPointsForTarget(target, days)
      allPoints.push(...points)
      processed++
    } catch (error) {
      failed++
      const message = error instanceof Error ? error.message : "history sync failed"
      if (errors.length < 20) errors.push(`${target.cardId}: ${message}`)
    }
  }

  if (allPoints.length > 0) {
    await appendPriceHistory(allPoints).catch((error) => {
      console.warn("[pricing/history-sync] append failed:", error)
    })
  }

  return {
    syncedAt,
    provider: "tcggo",
    candidates: targets.length,
    processed,
    historyPoints: allPoints.length,
    failed,
    errors,
    stoppedEarly,
  }
}

/** Refresh current prices + append today's snapshot when history endpoint is sparse. */
export async function syncTcgGoPricesWithHistory(options?: {
  maxCards?: number
  days?: number
  timeBudgetMs?: number
}): Promise<{
  prices: Awaited<ReturnType<typeof fetchCardPricesBatch>>
  history: SyncPriceHistoryResult
}> {
  const provider = getActivePriceProvider()
  if (provider !== "tcggo") {
    return {
      prices: [],
      history: await syncTcgGoPriceHistory(options),
    }
  }

  const targets = (await collectSyncTargets()).slice(0, options?.maxCards ?? DEFAULT_MAX_CARDS)
  const prices = await fetchCardPricesBatch(targets, {
    timeBudgetMs: options?.timeBudgetMs,
    provider: "tcggo",
  })
  const history = await syncTcgGoPriceHistory({ ...options, targets })

  return { prices, history }
}
