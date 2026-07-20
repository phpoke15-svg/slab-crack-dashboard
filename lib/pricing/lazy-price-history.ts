import { getCatalogCardById, type CatalogSearchHit } from "@/lib/db/cards-catalog"
import { appendPriceHistory, getCardPriceById, getPriceHistoryForCard } from "@/lib/pricing/db"
import { getActivePriceProvider } from "@/lib/pricing/provider"
import type { PriceHistoryPoint } from "@/lib/pricing/types"
import {
  fetchAllTcgGoHistoryPrices,
  pokemonTcgIdFromCardId,
  resolveTcgGoCardForTarget,
} from "@/lib/tcggo-api"
import { promoCardMeta } from "@/lib/trade-binder/promo-card-meta"

const HISTORY_TTL_MS = 24 * 60 * 60 * 1000
const FULL_HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MIN_HISTORY_POINTS = 2
const MIN_FULL_HISTORY_POINTS = 20
const DEFAULT_HISTORY_DAYS = 30
const DEFAULT_MAX_PAGES = 8
/** pokemon-api.com stores history back to card release; fetch from this floor. */
const FULL_HISTORY_DATE_FROM = "2015-01-01"

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return formatDate(date)
}

async function resolveCardForHistory(cardId: string): Promise<CatalogSearchHit | null> {
  const catalog = await getCatalogCardById(cardId)
  if (catalog) return catalog

  const cached = await getCardPriceById(cardId)
  if (!cached?.card_name || !cached.card_set) return null

  const meta = promoCardMeta(cardId)
  return {
    id: cardId,
    name: cached.card_name,
    setName: cached.card_set,
    setId: pokemonTcgIdFromCardId(cardId)?.split("-")[0] ?? "",
    number: cached.card_number ?? "",
    rarity: null,
    imageUrl: "",
    language: "en",
    japaneseName: null,
  }
}

async function isHistoryFresh(cardId: string, days: number): Promise<boolean> {
  const points = await getPriceHistoryForCard(cardId, 0, days)
  if (points.length < MIN_HISTORY_POINTS) return false

  const latest = points[points.length - 1]?.snapshotDate
  if (!latest) return false

  const ageMs = Date.now() - new Date(`${latest}T00:00:00Z`).getTime()
  return ageMs < HISTORY_TTL_MS
}

async function isFullHistoryFresh(cardId: string): Promise<boolean> {
  const points = await getPriceHistoryForCard(cardId, 0, 0)
  if (points.length < MIN_FULL_HISTORY_POINTS) return false

  const latest = points[points.length - 1]?.snapshotDate
  if (!latest) return false

  const ageMs = Date.now() - new Date(`${latest}T00:00:00Z`).getTime()
  return ageMs < FULL_HISTORY_TTL_MS
}

async function fetchTcgGoHistoryPoints(
  card: CatalogSearchHit,
  options: { days: number; full?: boolean },
): Promise<PriceHistoryPoint[]> {
  const meta = promoCardMeta(card.id)
  const tcgId = pokemonTcgIdFromCardId(card.id)
  const resolved = await resolveTcgGoCardForTarget({
    cardId: card.id,
    cardName: card.name,
    setName: card.setName,
    cardNumber: card.number,
    tcgGoId: meta?.tcgGoId,
    tcgplayerId: meta?.tcgplayerId,
  })

  const history = await fetchAllTcgGoHistoryPrices({
    tcgGoId: resolved?.id ?? meta?.tcgGoId,
    tcgId: resolved?.tcgid ?? tcgId,
    dateFrom: options.full ? FULL_HISTORY_DATE_FROM : daysAgo(options.days),
    dateTo: formatDate(new Date()),
    maxPages: options.full ? 0 : DEFAULT_MAX_PAGES,
  })

  return history.map((point) => ({
    cardId: card.id,
    snapshotDate: point.date,
    grade: point.grade,
    price: point.price,
    saleCount: point.saleCount,
    source: "tcggo",
  }))
}

export type EnsureCardPriceHistoryResult = {
  fetched: boolean
  points: number
  reason: "fresh" | "fetched" | "skipped" | "not_found" | "no_provider"
}

/** Fetch TCGGO price history for a card when viewed/searched and cache in price_history. */
export async function ensureCardPriceHistory(
  cardId: string,
  options?: { days?: number; force?: boolean; full?: boolean },
): Promise<EnsureCardPriceHistoryResult> {
  const full = options?.full ?? false
  const days = full ? 0 : (options?.days ?? DEFAULT_HISTORY_DAYS)

  if (getActivePriceProvider() !== "tcggo") {
    return { fetched: false, points: 0, reason: "no_provider" }
  }

  if (!options?.force) {
    const fresh = full ? await isFullHistoryFresh(cardId) : await isHistoryFresh(cardId, days)
    if (fresh) return { fetched: false, points: 0, reason: "fresh" }
  }

  const card = await resolveCardForHistory(cardId)
  if (!card) {
    return { fetched: false, points: 0, reason: "not_found" }
  }

  try {
    const points = await fetchTcgGoHistoryPoints(card, { days: days || DEFAULT_HISTORY_DAYS, full })
    if (points.length > 0) {
      await appendPriceHistory(points)
      return { fetched: true, points: points.length, reason: "fetched" }
    }
    return { fetched: false, points: 0, reason: "skipped" }
  } catch (error) {
    console.warn("[lazy-price-history] fetch failed:", cardId, error)
    return { fetched: false, points: 0, reason: "skipped" }
  }
}
