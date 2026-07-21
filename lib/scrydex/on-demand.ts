import type { CatalogSearchHit } from "@/lib/db/cards-catalog"
import { getRawPricesForCardIds } from "@/lib/db/priced-catalog"
import { createCatalogService } from "@/lib/scrydex/catalog-service"
import { lookupScrydexCatalogById } from "@/lib/scrydex/catalog-bridge"
import { isScrydexConfigured, legacyPokeIdToCatalogId, resolveCatalogId, scrydexOnDemandSearchRefreshLimit } from "@/lib/scrydex/constants"
import { ScrydexCreditBudgetError, recordCardActivity } from "@/lib/scrydex/credit-ledger"
import { getLegacyMapByPcId } from "@/lib/pricing/card-id-legacy-map"
import { legacyPcIdFromCardId } from "@/lib/types/card-id"
import { catalogHitNeedsScrydexRefresh } from "@/lib/trade-binder/enrich-catalog-hit"

async function resolveScrydexCatalogId(cardId: string): Promise<string | null> {
  const direct = resolveCatalogId(cardId)
  if (direct) return direct

  const legacyPcId = legacyPcIdFromCardId(cardId)
  if (!legacyPcId) return null

  const mapped = await getLegacyMapByPcId(legacyPcId)
  if (mapped?.new_poke_id) {
    return legacyPokeIdToCatalogId(mapped.new_poke_id)
  }
  return null
}

export type ScrydexActivity = "view" | "search" | "binder" | "portfolio" | "scan"

/** Refresh one card from Scrydex when stale — 1 credit on API fetch. */
export async function ensureScrydexCardFresh(
  cardId: string,
  opts?: { activity?: ScrydexActivity },
): Promise<CatalogSearchHit | null> {
  if (!isScrydexConfigured()) return null

  const catalogId = await resolveScrydexCatalogId(cardId)
  if (!catalogId) return null

  try {
    if (opts?.activity) {
      await recordCardActivity(catalogId, opts.activity)
    }

    const service = createCatalogService()
    await service.ensureFreshCard(catalogId)

    return lookupScrydexCatalogById(cardId)
  } catch (error) {
    if (error instanceof ScrydexCreditBudgetError) {
      console.warn("[scrydex/on-demand] credit budget:", error.message)
    } else {
      console.warn("[scrydex/on-demand] refresh failed:", error)
    }
    return lookupScrydexCatalogById(cardId)
  }
}

/** Pull Scrydex prices for search hits that are missing/stale — bounded per request. */
export async function refreshScrydexPricesForSearchHits(hits: CatalogSearchHit[]): Promise<CatalogSearchHit[]> {
  if (!isScrydexConfigured() || hits.length === 0) return hits

  const limit = scrydexOnDemandSearchRefreshLimit()
  const candidates = hits.filter((hit) => catalogHitNeedsScrydexRefresh(hit)).slice(0, limit)

  if (candidates.length === 0) return hits

  const refreshedById = new Map<string, CatalogSearchHit>()

  await Promise.all(
    candidates.map(async (hit) => {
      const fresh = await ensureScrydexCardFresh(hit.id, { activity: "search" })
      if (fresh) refreshedById.set(hit.id, fresh)
    }),
  )

  const rawPrices = await getRawPricesForCardIds(hits.map((hit) => hit.id))
  return hits.map((hit) => {
    const refreshed = refreshedById.get(hit.id)
    const rawPrice = rawPrices.get(hit.id)
    if (refreshed) {
      return {
        ...hit,
        imageUrl: refreshed.imageUrl || hit.imageUrl,
        rawPrice:
          (rawPrice && rawPrice > 0 ? rawPrice : refreshed.rawPrice) ??
          hit.rawPrice,
        priceSyncedAt: refreshed.priceSyncedAt ?? hit.priceSyncedAt,
      }
    }
    if (rawPrice && rawPrice > 0) return { ...hit, rawPrice }
    return hit
  })
}
