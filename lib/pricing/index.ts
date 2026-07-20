export type {
  CardPriceRow,
  CardPriceTarget,
  FetchedCardPrices,
  PriceHistoryPoint,
  PriceSource,
  SyncCardPricesResult,
} from "@/lib/pricing/types"

export {
  appendPriceHistory,
  getCardPriceById,
  getCardPricesForIds,
  getCardPricesMap,
  getPriceHistoryForCard,
  getRawPriceMapFromCardPrices,
  isCardPricesTableAvailable,
  listStaleCardPriceIds,
  upsertCardPricesSafe,
} from "@/lib/pricing/db"

export {
  fetchCardPricesBatch,
  fetchCardPricesForTarget,
  fetchCardPricesFromPriceCharting,
  fetchCardPricesFromTcgGo,
  priceChartingIdFromCardId,
} from "@/lib/pricing/fetch"

export { getActivePriceProvider, hasTcgGoApiKey, hasPriceChartingApiKey } from "@/lib/pricing/provider"
export { syncTcgGoPriceHistory } from "@/lib/pricing/history-sync"

export { syncUnifiedCardPrices } from "@/lib/pricing/sync"

export { resolveSearchCardPrices, enrichSearchCardPrices, enrichCardSearchHitsWithPrices, binderPriceInputsFromCards, applySearchPricesToCards, applyPricesToCardSearchHits, SEARCH_SERVER_LIVE_PRICE_LIMIT } from "@/lib/pricing/persist-search-prices"

export {
  buildCatalogPriceSearchQuery,
  formatCatalogCardNumber,
  formatCatalogCardNumberWithTotal,
} from "@/lib/pricing/catalog-search-query"

export { lookupCatalogCardEntry } from "@/lib/pricing/catalog-card-lookup"
export { getLazyCardPrice } from "@/lib/pricing/lazy-card-price"

export {
  cardPriceRowToMockEntry,
  mergeCachedRawPrices,
  toBinderRawPrice,
  toSlabAnomalyPrices,
} from "@/lib/pricing/views"
