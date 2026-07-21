import { flattenHistoryPoints, parseRemoteCardList } from "@/lib/scrydex/adapters"
import { ScrydexClient } from "@/lib/scrydex/client"
import { recordCardActivity } from "@/lib/scrydex/credit-ledger"
import {
  getCardsWithPricesBatch,
  getCatalogCard,
  isPriceStale,
  loadCardBundle,
  persistCardPricingBundle,
  persistHistoryPoints,
  searchLocalCatalog,
  upsertCatalogCards,
} from "@/lib/scrydex/db"
import { SCRYDEX_CACHE } from "@/lib/scrydex/types"
import type { CardPriceBundle, CatalogCardRow, TcgGame } from "@/lib/scrydex/types"

export class CatalogService {
  constructor(private scrydex = ScrydexClient.fromEnv()) {}

  /** Local-first search — 0 credits on cache hit. */
  async search(input: { game: TcgGame; q: string; page?: number; pageSize?: number }) {
    const page = input.page ?? 1
    const pageSize = Math.min(Math.max(input.pageSize ?? 24, 1), 100)

    const local = await searchLocalCatalog({ game: input.game, q: input.q, page, pageSize })
    if (local.cards.length > 0 || !input.q.trim()) {
      return { source: "local" as const, ...local, creditsUsed: 0 }
    }

    const remote = await this.scrydex.searchCards(input.game, { q: input.q, page, pageSize })
    const cards = parseRemoteCardList(input.game, remote.data ?? [])
    await upsertCatalogCards(cards)

    return {
      source: "scrydex" as const,
      cards,
      total: remote.totalCount ?? remote.total_count ?? cards.length,
      creditsUsed: 1,
    }
  }

  /** Batch binder/portfolio load — single RPC, 0 credits. */
  async getCardsWithPrices(catalogIds: string[]) {
    const unique = [...new Set(catalogIds.filter(Boolean))]
    if (unique.length === 0) return []
    return getCardsWithPricesBatch(unique)
  }

  /** Read full card bundle from local DB — 0 credits. */
  async getCardBundle(catalogId: string, opts?: { trackView?: boolean }): Promise<CardPriceBundle | null> {
    const bundle = await loadCardBundle(catalogId)
    if (!bundle) return null
    if (opts?.trackView) await recordCardActivity(catalogId, "view")

    return {
      card: bundle.card,
      raw: bundle.raw,
      graded: bundle.graded,
      population: bundle.population,
      history: bundle.history,
      creditsUsed: 0,
    }
  }

  /** Refresh prices only when stale (>24h). */
  async ensureFreshPrices(catalogId: string): Promise<{ source: "cache" | "scrydex"; creditsUsed: number }> {
    const stale = await isPriceStale(catalogId, SCRYDEX_CACHE.priceTtlMs)
    if (!stale) return { source: "cache", creditsUsed: 0 }

    const existing = await getCatalogCard(catalogId)
    if (!existing) return { source: "cache", creditsUsed: 0 }

    const remote = await this.scrydex.getCard(existing.game, existing.scrydex_id, {
      includePrices: true,
      catalogId,
    })

    const card = remote.data
    if (!card) return { source: "cache", creditsUsed: 0 }

    await persistCardPricingBundle(existing.game, card)
    return { source: "scrydex", creditsUsed: 1 }
  }

  /** Backfill history for a card — 3 credits, cached locally. */
  async ensureHistory(catalogId: string, days = 90): Promise<{ points: number; creditsUsed: number }> {
    const existing = await getCatalogCard(catalogId)
    if (!existing) return { points: 0, creditsUsed: 0 }

    const remote = await this.scrydex.getPriceHistory(
      existing.game,
      existing.scrydex_id,
      { days },
      { catalogId },
    )

    const points = flattenHistoryPoints(catalogId, remote.data)
    await persistHistoryPoints(catalogId, points)
    return { points: points.length, creditsUsed: 3 }
  }
}

export function createCatalogService(): CatalogService {
  return new CatalogService()
}

export type { CatalogCardRow, TcgGame }
