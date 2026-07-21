export * from "@/lib/scrydex/types"
export * from "@/lib/scrydex/constants"
export { ScrydexClient } from "@/lib/scrydex/client"
export { CatalogService, createCatalogService } from "@/lib/scrydex/catalog-service"
export { CreditLedger, ScrydexCreditBudgetError, recordCardActivity, getCreditsUsedToday } from "@/lib/scrydex/credit-ledger"
export { hydrateExpansionPage, syncRecentExpansions } from "@/lib/scrydex/hydrate"
export { syncScrydexPrices, probeScrydexSync } from "@/lib/scrydex/price-sync"
export { resolveScanToCatalog, hashScanImage } from "@/lib/scrydex/vision-pipeline"
export {
  upsertCatalogCards,
  getCardsWithPricesBatch,
  loadCardBundle,
  searchLocalCatalog,
} from "@/lib/scrydex/db"
export {
  toCatalogId,
  splitCatalogId,
  legacyPokeIdToCatalogId,
  catalogIdToLegacyPokeId,
  resolveCatalogId,
  catalogHitIdForUi,
} from "@/lib/scrydex/constants"
export {
  catalogRowToSearchHit,
  searchScrydexCatalogLocal,
  lookupScrydexCatalogById,
  lookupScrydexCatalogCardsByIds,
} from "@/lib/scrydex/catalog-bridge"
export {
  scrydexBundleToCardPriceRow,
  getScrydexRawPricesForIds,
  getScrydexCardPriceRowsForIds,
} from "@/lib/scrydex/price-adapter"
