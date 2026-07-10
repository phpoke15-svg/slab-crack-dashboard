import { maybeSendRestockDiscordAlert } from "@/lib/restocks/alerts"
import { applyStockSnapshot, listActiveProductsForSync } from "@/lib/restocks/store"
import { fetchWalmartItemStock, isWalmartAffiliateConfigured } from "@/lib/restocks/walmart"
import type { RestockProduct, StockSnapshot } from "@/lib/restocks/types"

export type SyncRestocksResult = {
  walmartConfigured: boolean
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

/** Poll Walmart Affiliate for all active Walmart SKUs. */
export async function syncWalmartRestocks(): Promise<SyncRestocksResult> {
  const tallies = { updated: 0, restocked: 0, alertsSent: 0 }
  const errors: SyncRestocksResult["errors"] = []
  const configured = isWalmartAffiliateConfigured()

  if (!configured) {
    return {
      walmartConfigured: false,
      checked: 0,
      updated: 0,
      restocked: 0,
      errors: [],
      alertsSent: 0,
    }
  }

  const products = await listActiveProductsForSync("walmart")
  let checked = 0

  for (const product of products) {
    if (product.externalId.startsWith("REPLACE_")) continue
    checked += 1
    try {
      const snapshot = await fetchWalmartItemStock(product.externalId)
      await applyAndMaybeAlert(product, snapshot, tallies)
      // Be polite to the API
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
    checked,
    updated: tallies.updated,
    restocked: tallies.restocked,
    errors,
    alertsSent: tallies.alertsSent,
  }
}

/** Apply a Pokemon Center (or manual) stock report for one product. */
export async function applyExternalStockReport(
  product: RestockProduct,
  snapshot: Omit<StockSnapshot, "source"> & { source?: string },
): Promise<{ restocked: boolean; product: RestockProduct }> {
  const result = await applyStockSnapshot(product.id, {
    inStock: snapshot.inStock,
    price: snapshot.price,
    source: snapshot.source ?? "pc_report",
    checkedAt: snapshot.checkedAt,
  })
  if (!result) throw new Error("Product not found")

  if (result.restocked) {
    await maybeSendRestockDiscordAlert(result.product)
  }
  return { restocked: result.restocked, product: result.product }
}
