import { maybeSendRestockDiscordAlert } from "@/lib/restocks/alerts"
import {
  applyStockSnapshot,
  listActiveProductsForSync,
  upsertDiscoveredProduct,
} from "@/lib/restocks/store"
import {
  fetchWalmartItemStock,
  getWalmartDiscoveryQueries,
  isPokemonTcgSealedCandidate,
  isWalmartAffiliateConfigured,
  searchWalmartProducts,
} from "@/lib/restocks/walmart"
import type { RestockProduct, StockSnapshot } from "@/lib/restocks/types"

export type SyncRestocksResult = {
  walmartConfigured: boolean
  discovered: number
  discoveryErrors: string[]
  checked: number
  updated: number
  restocked: number
  errors: Array<{ productId: string; name: string; error: string }>
  alertsSent: number
}

async function applyAndMaybeAlert(
  product: RestockProduct,
  snapshot: StockSnapshot,
  tallies: { updated: number; restocked: number; alertsSent: number },
) {
  const result = await applyStockSnapshot(product.id, snapshot)
  if (!result) return
  if (result.changed) tallies.updated += 1
  if (result.restocked) {
    tallies.restocked += 1
    if (await maybeSendRestockDiscordAlert(result.product)) tallies.alertsSent += 1
  }
}

/**
 * Search Walmart for sealed Pokémon TCG products and upsert into the watchlist.
 * No manual SKU hunting required once Affiliate API is configured.
 */
export async function discoverWalmartPokemonProducts(): Promise<{
  discovered: number
  errors: string[]
}> {
  if (!isWalmartAffiliateConfigured()) {
    return { discovered: 0, errors: [] }
  }

  const queries = getWalmartDiscoveryQueries()
  const seen = new Set<string>()
  let discovered = 0
  const errors: string[] = []

  for (const query of queries) {
    try {
      const hits = await searchWalmartProducts(query, { numItems: 25 })
      for (const hit of hits) {
        if (seen.has(hit.itemId)) continue
        seen.add(hit.itemId)
        if (!isPokemonTcgSealedCandidate(hit.name)) continue

        const saved = await upsertDiscoveredProduct({
          retailer: "walmart",
          externalId: hit.itemId,
          name: hit.name,
          productUrl: hit.productUrl,
          imageUrl: hit.imageUrl,
          price: hit.price,
          inStock: hit.inStock,
          category: "sealed",
          source: "walmart_discovery",
        })
        if (saved) discovered += 1
      }
      await new Promise((r) => setTimeout(r, 300))
    } catch (err) {
      errors.push(
        `${query}: ${err instanceof Error ? err.message : "search failed"}`,
      )
    }
  }

  return { discovered, errors }
}

/** Discover new Walmart SKUs (optional) then poll stock for all active Walmart products. */
export async function syncWalmartRestocks(options?: {
  discover?: boolean
}): Promise<SyncRestocksResult> {
  const tallies = { updated: 0, restocked: 0, alertsSent: 0 }
  const errors: SyncRestocksResult["errors"] = []
  const configured = isWalmartAffiliateConfigured()
  const runDiscover = options?.discover !== false

  if (!configured) {
    return {
      walmartConfigured: false,
      discovered: 0,
      discoveryErrors: [],
      checked: 0,
      updated: 0,
      restocked: 0,
      errors: [],
      alertsSent: 0,
    }
  }

  let discovered = 0
  let discoveryErrors: string[] = []
  if (runDiscover) {
    const discovery = await discoverWalmartPokemonProducts()
    discovered = discovery.discovered
    discoveryErrors = discovery.errors
  }

  const products = await listActiveProductsForSync("walmart")
  let checked = 0

  for (const product of products) {
    if (product.externalId.startsWith("REPLACE_")) continue
    checked += 1
    try {
      const snapshot = await fetchWalmartItemStock(product.externalId)
      await applyAndMaybeAlert(product, snapshot, tallies)
      await new Promise((r) => setTimeout(r, 250))
    } catch (err) {
      errors.push({
        productId: product.id,
        name: product.name,
        error: err instanceof Error ? err.message : "Walmart sync failed",
      })
    }
  }

  return {
    walmartConfigured: true,
    discovered,
    discoveryErrors,
    checked,
    updated: tallies.updated,
    restocked: tallies.restocked,
    errors,
    alertsSent: tallies.alertsSent,
  }
}

/** Apply a manual stock report for one product (kept for ops; PC focus is Queue Watch). */
export async function applyExternalStockReport(
  product: RestockProduct,
  snapshot: Omit<StockSnapshot, "source"> & { source?: string },
): Promise<{ restocked: boolean; product: RestockProduct }> {
  const result = await applyStockSnapshot(product.id, {
    inStock: snapshot.inStock,
    price: snapshot.price,
    source: snapshot.source ?? "manual_report",
    checkedAt: snapshot.checkedAt,
  })
  if (!result) throw new Error("Product not found")

  if (result.restocked) {
    await maybeSendRestockDiscordAlert(result.product)
  }
  return { restocked: result.restocked, product: result.product }
}
