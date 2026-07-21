import { getFeaturedCatalogCards } from "@/lib/db/cards-catalog"
import { listDistinctBinderCards } from "@/lib/db/binder-card-prices"
import { upsertBinderCardPrices } from "@/lib/db/binder-card-prices"
import { getWatchlistFromDb } from "@/lib/db/watchlist"
import { fetchCardPricesBatch } from "@/lib/pricing/fetch"
import {
  getActivePriceProvider,
  hasTcgGoApiKey,
} from "@/lib/pricing/provider"
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

async function popularTargetsFromCatalog(limit: number): Promise<CardPriceTarget[]> {
  try {
    const hits = await getFeaturedCatalogCards(limit)
    return hits
      .filter((hit) => (hit.rawPrice ?? 0) > 0)
      .map((hit) => ({
        cardId: hit.id,
        cardName: hit.name,
        setName: hit.setName,
        cardNumber: hit.number || undefined,
        priceChartingId: hit.id.startsWith("pc-") ? hit.id.replace(/^pc-/, "") : undefined,
      }))
  } catch (error) {
    console.warn("[pricing/sync] popular catalog targets failed:", error)
    return []
  }
}

export async function collectSyncTargets(): Promise<CardPriceTarget[]> {
  const [binderCards, watchlist, popularCards] = await Promise.all([
    listDistinctBinderCards().catch(() => [] as CardPriceTarget[]),
    getWatchlistFromDb().catch(() => []),
    popularTargetsFromCatalog(40),
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

  return mergeTargets(binderCards, watchlistTargets, popularCards)
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

export async function probeUnifiedPriceSync(): Promise<{
  ok: boolean
  checks: Record<string, string | boolean>
}> {
  const checks: Record<string, string | boolean> = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    priceProvider: getActivePriceProvider() ?? "none",
    tcgGoKey: hasTcgGoApiKey(),
    cronSecret: Boolean(process.env.CRON_SECRET),
  }

  try {
    const targets = await collectSyncTargets()
    checks.targetCount = targets.length
    checks.ok = Boolean(checks.supabaseUrl && checks.serviceRoleKey && checks.priceProvider !== "none")
  } catch (error) {
    checks.ok = false
    checks.collectError = error instanceof Error ? error.message : "collect failed"
  }

  return { ok: Boolean(checks.ok), checks }
}

export async function syncUnifiedCardPrices(options?: {
  maxCards?: number
  force?: boolean
  timeBudgetMs?: number
}): Promise<SyncCardPricesResult> {
  const provider = getActivePriceProvider()
  const syncedAt = new Date().toISOString()
  const snapshotDate = syncedAt.slice(0, 10)
  const maxCards =
    options?.maxCards ??
    parsePositiveInt(process.env.PRICE_SYNC_MAX_CARDS, DEFAULT_MAX_CARDS)
  const timeBudgetMs =
    options?.timeBudgetMs ??
    parsePositiveInt(process.env.PRICE_SYNC_TIME_BUDGET_MS, DEFAULT_TIME_BUDGET_MS)

  if (!provider) {
    return {
      syncedAt,
      candidates: 0,
      refreshed: 0,
      skipped: 0,
      failed: 0,
      processed: 0,
      remaining: 0,
      stoppedEarly: false,
      errors: ["No pricing provider configured (set RAPIDAPI_POKEMON_TCG_KEY)"],
      source: "skipped",
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      syncedAt,
      candidates: 0,
      refreshed: 0,
      skipped: 0,
      failed: 0,
      processed: 0,
      remaining: 0,
      stoppedEarly: false,
      errors: ["Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"],
      source: "skipped",
    }
  }

  const targets = await collectSyncTargets()
  const staleBefore = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString()

  let staleIds: Set<string>
  try {
    staleIds = options?.force
      ? new Set(targets.map((t) => t.cardId))
      : await listStaleCardPriceIds(
          targets.map((t) => t.cardId),
          staleBefore,
          { provider },
        )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stale lookup failed"
    return {
      syncedAt,
      candidates: targets.length,
      refreshed: 0,
      skipped: 0,
      failed: 0,
      processed: 0,
      remaining: 0,
      stoppedEarly: false,
      errors: [message],
      source: "skipped",
    }
  }

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
      source: provider,
    }
  }

  const batchResults = await fetchCardPricesBatch(toSync, { timeBudgetMs, provider })
  const processed = batchResults.length
  const stoppedEarly = processed < toSync.length
  const remaining = Math.max(0, staleTargets.length - processed)

  const upsertResult = await upsertCardPricesSafe(batchResults)
  const refreshed = upsertResult.count
  const errors: string[] = upsertResult.error ? [upsertResult.error] : []

  const historyPoints: PriceHistoryPoint[] = []
  const binderRows: Array<{
    cardId: string
    rawPrice: number
    cardName: string
    cardSet: string
    cardNumber?: string
  }> = []

  let failed = 0

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
    source: provider,
  }
}
