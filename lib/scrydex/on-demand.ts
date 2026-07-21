import type { CatalogSearchHit } from "@/lib/db/cards-catalog"
import { getRawPricesForCardIds } from "@/lib/db/priced-catalog"
import { createCatalogService } from "@/lib/scrydex/catalog-service"
import { lookupScrydexCatalogById } from "@/lib/scrydex/catalog-bridge"
import { isScrydexConfigured, resolveCatalogId, scrydexOnDemandSearchRefreshLimit } from "@/lib/scrydex/constants"
import { ScrydexCreditBudgetError, recordCardActivity } from "@/lib/scrydex/credit-ledger"
import { isPriceStale } from "@/lib/scrydex/db"
import { SCRYDEX_CACHE } from "@/lib/scrydex/types"

export type ScrydexActivity = "view" | "search" | "binder" | "portfolio" | "scan"

/** Refresh one card from Scrydex when stale — 1 credit on API fetch. */
export async function ensureScrydexCardFresh(
  cardId: string,
  opts?: { activity?: ScrydexActivity },
): Promise<CatalogSearchHit | null> {
  if (!isScrydexConfigured()) return null

  const catalogId = resolveCatalogId(cardId)
  if (!catalogId) return null

  try {
    if (opts?.activity) {
      await recordCardActivity(catalogId, opts.activity)
    }

    const stale = await isPriceStale(catalogId, SCRYDEX_CACHE.priceTtlMs)
    if (stale) {
      const service = createCatalogService()
      await service.ensureFreshPrices(catalogId)
    }

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
  const candidates = hits
    .filter((hit) => (hit.rawPrice ?? 0) <= 0)
    .slice(0, limit)

  if (candidates.length === 0) return hits

  await Promise.all(
    candidates.map((hit) => ensureScrydexCardFresh(hit.id, { activity: "search" })),
  )

  const rawPrices = await getRawPricesForCardIds(hits.map((hit) => hit.id))
  return hits.map((hit) => {
    const rawPrice = rawPrices.get(hit.id)
    if (rawPrice && rawPrice > 0) return { ...hit, rawPrice }
    return hit
  })
}
