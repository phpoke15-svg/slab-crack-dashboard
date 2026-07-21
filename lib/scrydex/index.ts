export * from "@/lib/scrydex/types"
export * from "@/lib/scrydex/constants"
export { ScrydexClient } from "@/lib/scrydex/client"
export { CatalogService, createCatalogService } from "@/lib/scrydex/catalog-service"
export { CreditLedger, ScrydexCreditBudgetError, recordCardActivity, getCreditsUsedToday } from "@/lib/scrydex/credit-ledger"
export { hydrateExpansionPage, syncRecentExpansions, syncAllExpansions } from "@/lib/scrydex/hydrate"
export {
  pickNextHydrationJob,
  registerSeededExpansionJobs,
  countHydrationProgress,
} from "@/lib/scrydex/hydration-queue"
export { syncScrydexPrices, probeScrydexSync } from "@/lib/scrydex/price-sync"
export { resolveScanToCatalog, hashScanImage, ScrydexVisionNoMatchError, visionScanGameScope } from "@/lib/scrydex/vision-pipeline"
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
  ensureScrydexCardFresh,
  refreshScrydexPricesForSearchHits,
} from "@/lib/scrydex/on-demand"
export {
  scrydexBundleToCardPriceRow,
  getScrydexRawPricesForIds,
  getScrydexCardPriceRowsForIds,
} from "@/lib/scrydex/price-adapter"
