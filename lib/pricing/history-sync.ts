import { appendPriceHistory } from "@/lib/pricing/db"
import { fetchCardPricesBatch } from "@/lib/pricing/fetch"
import { getActivePriceProvider } from "@/lib/pricing/provider"
import {
  listCatalogHistoryTargets,
  readHistorySyncCursor,
  writeHistorySyncCursor,
} from "@/lib/pricing/history-cursor"
import type { CardPriceTarget, PriceHistoryPoint } from "@/lib/pricing/types"
import {
  fetchAllTcgGoHistoryPrices,
  pokemonTcgIdFromCardId,
  resolveTcgGoCardForTarget,
} from "@/lib/tcggo-api"
import { promoCardMeta } from "@/lib/trade-binder/promo-card-meta"
import { collectSyncTargets } from "@/lib/pricing/sync"

const DEFAULT_HISTORY_DAYS = 30
const DEFAULT_MAX_CARDS = 40
const DEFAULT_TIME_BUDGET_MS = 240_000
const CATALOG_DEFAULT_MAX_CARDS = 60
const CATALOG_DEFAULT_TIME_BUDGET_MS = 280_000
const CATALOG_DEFAULT_DAYS = 3650
const CATALOG_DEFAULT_MAX_PAGES = 50
const TCGGO_HISTORY_RATE_LIMIT_MS = 2100

export type SyncPriceHistoryMode = "priority" | "catalog"

export type SyncPriceHistoryResult = {
  syncedAt: string
  provider: "tcggo" | "skipped"
  mode: SyncPriceHistoryMode
  candidates: number
  processed: number
  historyPoints: number
  failed: number
  errors: string[]
  stoppedEarly: boolean
  cursorOffset?: number
  nextCursorOffset?: number
  catalogSize?: number
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.round(parsed)
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return formatDate(date)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function historyConfig(mode: SyncPriceHistoryMode, full?: boolean) {
  if (mode === "catalog") {
    const days = parsePositiveInt(
      process.env.PRICE_HISTORY_CATALOG_DAYS,
      full ? CATALOG_DEFAULT_DAYS : DEFAULT_HISTORY_DAYS,
    )
    const maxPages = parsePositiveInt(
      process.env.PRICE_HISTORY_CATALOG_MAX_PAGES,
      full ? CATALOG_DEFAULT_MAX_PAGES : 8,
    )
    return { days, maxPages }
  }

  return {
    days: DEFAULT_HISTORY_DAYS,
    maxPages: full ? CATALOG_DEFAULT_MAX_PAGES : 8,
  }
}

async function historyPointsForTarget(
  target: CardPriceTarget,
  days: number,
  maxPages: number,
): Promise<PriceHistoryPoint[]> {
  const tcgId = pokemonTcgIdFromCardId(target.cardId)
  const meta = promoCardMeta(target.cardId)
  const card = await resolveTcgGoCardForTarget({
    cardId: target.cardId,
    cardName: target.cardName,
    setName: target.setName,
    cardNumber: target.cardNumber,
    tcgGoId: target.tcgGoId ?? meta?.tcgGoId,
    tcgplayerId: target.tcgplayerId ?? meta?.tcgplayerId,
  })

  const history = await fetchAllTcgGoHistoryPrices({
    tcgGoId: card?.id ?? target.tcgGoId,
    tcgId: card?.tcgid ?? tcgId,
    cardmarketId: card?.cardmarket_id,
    dateFrom: daysAgo(days),
    dateTo: formatDate(new Date()),
    maxPages,
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

async function resolveHistoryTargets(options: {
  mode: SyncPriceHistoryMode
  maxCards: number
  catalogOffset?: number
  targets?: CardPriceTarget[]
}): Promise<{
  targets: CardPriceTarget[]
  cursorOffset?: number
  nextCursorOffset?: number
  catalogSize?: number
}> {
  if (options.targets) {
    return { targets: options.targets.slice(0, options.maxCards) }
  }

  if (options.mode === "catalog") {
    const offset = options.catalogOffset ?? (await readHistorySyncCursor())
    const batch = await listCatalogHistoryTargets(offset, options.maxCards)
    return {
      targets: batch.targets,
      cursorOffset: batch.cursorOffset,
      nextCursorOffset: batch.nextOffset,
      catalogSize: batch.catalogSize,
    }
  }

  const priority = await collectSyncTargets()
  return { targets: priority.slice(0, options.maxCards) }
}

export async function syncTcgGoPriceHistory(options?: {
  mode?: SyncPriceHistoryMode
  maxCards?: number
  days?: number
  full?: boolean
  maxPages?: number
  timeBudgetMs?: number
  targets?: CardPriceTarget[]
  catalogOffset?: number
  rateLimitMs?: number
}): Promise<SyncPriceHistoryResult> {
  const syncedAt = new Date().toISOString()
  const provider = getActivePriceProvider()
  const mode = options?.mode ?? "priority"
  const full = options?.full ?? mode === "catalog"
  const config = historyConfig(mode, full)
  const days = options?.days ?? config.days
  const maxPages = options?.maxPages ?? config.maxPages
  const maxCards =
    options?.maxCards ??
    (mode === "catalog"
      ? parsePositiveInt(process.env.PRICE_HISTORY_CATALOG_MAX_CARDS, CATALOG_DEFAULT_MAX_CARDS)
      : DEFAULT_MAX_CARDS)
  const timeBudgetMs =
    options?.timeBudgetMs ??
    (mode === "catalog"
      ? parsePositiveInt(process.env.PRICE_HISTORY_CATALOG_TIME_BUDGET_MS, CATALOG_DEFAULT_TIME_BUDGET_MS)
      : DEFAULT_TIME_BUDGET_MS)
  const rateLimitMs = options?.rateLimitMs ?? TCGGO_HISTORY_RATE_LIMIT_MS
  const startedAt = Date.now()

  if (provider !== "tcggo") {
    return {
      syncedAt,
      provider: "skipped",
      mode,
      candidates: 0,
      processed: 0,
      historyPoints: 0,
      failed: 0,
      errors: ["TCGGO price history sync requires RAPIDAPI_POKEMON_TCG_KEY"],
      stoppedEarly: false,
    }
  }

  const resolved = await resolveHistoryTargets({ mode, maxCards, catalogOffset: options?.catalogOffset, targets: options?.targets })
  const targets = resolved.targets
  const allPoints: PriceHistoryPoint[] = []
  const errors: string[] = []
  let processed = 0
  let failed = 0
  let stoppedEarly = false

  for (let index = 0; index < targets.length; index++) {
    if (Date.now() - startedAt >= timeBudgetMs) {
      stoppedEarly = true
      break
    }

    const target = targets[index]!
    try {
      const points = await historyPointsForTarget(target, days, maxPages)
      allPoints.push(...points)
      processed++
    } catch (error) {
      failed++
      const message = error instanceof Error ? error.message : "history sync failed"
      if (errors.length < 20) errors.push(`${target.cardId}: ${message}`)
    }

    if (index < targets.length - 1 && Date.now() - startedAt + rateLimitMs < timeBudgetMs) {
      await sleep(rateLimitMs)
    }
  }

  if (allPoints.length > 0) {
    await appendPriceHistory(allPoints).catch((error) => {
      console.warn("[pricing/history-sync] append failed:", error)
    })
  }

  let nextCursorOffset = resolved.nextCursorOffset
  if (mode === "catalog" && resolved.catalogSize != null) {
    const advancedBy = stoppedEarly ? processed : targets.length
    const start = resolved.cursorOffset ?? 0
    nextCursorOffset =
      resolved.catalogSize > 0
        ? (start + advancedBy >= resolved.catalogSize ? 0 : start + advancedBy)
        : 0
    await writeHistorySyncCursor(nextCursorOffset, resolved.catalogSize)
  }

  return {
    syncedAt,
    provider: "tcggo",
    mode,
    candidates: targets.length,
    processed,
    historyPoints: allPoints.length,
    failed,
    errors,
    stoppedEarly,
    cursorOffset: resolved.cursorOffset,
    nextCursorOffset,
    catalogSize: resolved.catalogSize,
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
