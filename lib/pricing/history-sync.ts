import { fetchCardPricesBatch } from "@/lib/pricing/fetch"
import { ensureCardPriceHistory } from "@/lib/pricing/lazy-price-history"
import { getActivePriceProvider } from "@/lib/pricing/provider"
import type { CardPriceTarget } from "@/lib/pricing/types"
import { collectSyncTargets } from "@/lib/pricing/sync"

const DEFAULT_HISTORY_DAYS = 30
const DEFAULT_MAX_CARDS = 40
const DEFAULT_TIME_BUDGET_MS = 240_000

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
  const errors: string[] = []
  let processed = 0
  let historyPoints = 0
  let failed = 0
  let stoppedEarly = false

  for (const target of targets) {
    if (Date.now() - startedAt >= timeBudgetMs) {
      stoppedEarly = true
      break
    }

    try {
      const result = await ensureCardPriceHistory(target.cardId, { days, force: true })
      if (result.reason === "fetched") {
        processed++
        historyPoints += result.points
      } else if (result.reason === "fresh") {
        processed++
      } else if (result.reason === "not_found") {
        failed++
        if (errors.length < 20) errors.push(`${target.cardId}: card not found`)
      }
    } catch (error) {
      failed++
      const message = error instanceof Error ? error.message : "history sync failed"
      if (errors.length < 20) errors.push(`${target.cardId}: ${message}`)
    }
  }

  return {
    syncedAt,
    provider: "tcggo",
    candidates: targets.length,
    processed,
    historyPoints,
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
