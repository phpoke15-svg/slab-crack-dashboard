import type { CatalogSearchHit } from "@/lib/db/cards-catalog"
import { isLowResCardImage, isPlaceholderCardImage } from "@/lib/card-image-url"

export function catalogHitNeedsScrydexRefresh(hit: CatalogSearchHit): boolean {
  if ((hit.rawPrice ?? 0) <= 0) return true
  return isPlaceholderCardImage(hit.imageUrl) || isLowResCardImage(hit.imageUrl)
}

/** Prefer Scrydex metadata/pricing when the local cards row is incomplete. */
export function enrichCatalogHitWithScrydex(
  base: CatalogSearchHit,
  scrydex: CatalogSearchHit,
): CatalogSearchHit {
  const baseImageBad =
    isPlaceholderCardImage(base.imageUrl) ||
    base.imageUrl === "/placeholder.svg" ||
    isLowResCardImage(base.imageUrl)
  const scrydexHasImage =
    !isPlaceholderCardImage(scrydex.imageUrl) && scrydex.imageUrl !== "/placeholder.svg"

  return {
    ...base,
    name: base.name || scrydex.name,
    setName: base.setName || scrydex.setName,
    setId: base.setId || scrydex.setId,
    number: base.number || scrydex.number,
    rarity: base.rarity ?? scrydex.rarity,
    imageUrl:
      scrydexHasImage && (baseImageBad || isLowResCardImage(base.imageUrl))
        ? scrydex.imageUrl
        : base.imageUrl,
    rawPrice: (base.rawPrice ?? 0) > 0 ? base.rawPrice : scrydex.rawPrice,
    priceSyncedAt: (base.rawPrice ?? 0) > 0 ? base.priceSyncedAt : scrydex.priceSyncedAt,
    priceUnavailable: base.priceUnavailable ?? scrydex.priceUnavailable,
  }
}
