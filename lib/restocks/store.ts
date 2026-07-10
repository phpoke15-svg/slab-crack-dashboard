import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { RestockProduct, RestockRetailer, StockSnapshot } from "@/lib/restocks/types"

type DbProduct = {
  id: string
  retailer: RestockRetailer
  external_id: string
  name: string
  product_url: string
  image_url: string | null
  msrp: number | null
  category: string
  queue_likely: boolean
  active: boolean
  in_stock: boolean | null
  price: number | null
  last_checked_at: string | null
  last_restock_at: string | null
  last_source: string | null
  updated_at: string
}

const memoryProducts = new Map<string, RestockProduct>()

function mapProduct(row: DbProduct): RestockProduct {
  return {
    id: row.id,
    retailer: row.retailer,
    externalId: row.external_id,
    name: row.name,
    productUrl: row.product_url,
    imageUrl: row.image_url,
    msrp: row.msrp == null ? null : Number(row.msrp),
    category: row.category,
    queueLikely: Boolean(row.queue_likely),
    active: Boolean(row.active),
    inStock: row.in_stock,
    price: row.price == null ? null : Number(row.price),
    lastCheckedAt: row.last_checked_at,
    lastRestockAt: row.last_restock_at,
    lastSource: row.last_source,
    updatedAt: row.updated_at,
  }
}

export async function listRestockProducts(options?: {
  retailer?: RestockRetailer
  inStockOnly?: boolean
}): Promise<RestockProduct[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient()
      let query = supabase
        .from("restock_products")
        .select("*")
        .eq("active", true)
        .order("updated_at", { ascending: false })

      if (options?.retailer) query = query.eq("retailer", options.retailer)
      if (options?.inStockOnly) query = query.eq("in_stock", true)

      const { data, error } = await query
      if (error) throw error
      return (data as DbProduct[]).map(mapProduct)
    } catch {
      // table may not exist yet
    }
  }

  let rows = [...memoryProducts.values()].filter((p) => p.active)
  if (options?.retailer) rows = rows.filter((p) => p.retailer === options.retailer)
  if (options?.inStockOnly) rows = rows.filter((p) => p.inStock === true)
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function listActiveProductsForSync(retailer?: RestockRetailer): Promise<RestockProduct[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient()
      let query = supabase.from("restock_products").select("*").eq("active", true)
      if (retailer) query = query.eq("retailer", retailer)
      const { data, error } = await query
      if (error) throw error
      return (data as DbProduct[]).map(mapProduct)
    } catch {
      // fall through
    }
  }
  return [...memoryProducts.values()].filter(
    (p) => p.active && (!retailer || p.retailer === retailer),
  )
}

export async function getRestockProductByExternal(
  retailer: RestockRetailer,
  externalId: string,
): Promise<RestockProduct | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from("restock_products")
        .select("*")
        .eq("retailer", retailer)
        .eq("external_id", externalId)
        .maybeSingle()
      if (error) throw error
      return data ? mapProduct(data as DbProduct) : null
    } catch {
      // fall through
    }
  }
  return (
    [...memoryProducts.values()].find(
      (p) => p.retailer === retailer && p.externalId === externalId,
    ) ?? null
  )
}

export type ApplyStockResult = {
  product: RestockProduct
  changed: boolean
  restocked: boolean
}

/**
 * Apply a stock snapshot. Records an event when in_stock flips.
 * Returns restocked=true on OOS/unknown → in-stock rising edge.
 */
export async function applyStockSnapshot(
  productId: string,
  snapshot: StockSnapshot,
): Promise<ApplyStockResult | null> {
  const checkedAt = snapshot.checkedAt ?? new Date().toISOString()
  const price = snapshot.price ?? null

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient()
      const { data: existing, error: readError } = await supabase
        .from("restock_products")
        .select("*")
        .eq("id", productId)
        .maybeSingle()
      if (readError) throw readError
      if (!existing) return null

      const prev = mapProduct(existing as DbProduct)
      const wasInStock = prev.inStock
      const restocked = snapshot.inStock === true && wasInStock !== true
      const changed = wasInStock !== snapshot.inStock || (price != null && price !== prev.price)

      const patch = {
        in_stock: snapshot.inStock,
        price: price ?? prev.price,
        last_checked_at: checkedAt,
        last_source: snapshot.source,
        last_restock_at: restocked ? checkedAt : prev.lastRestockAt,
        updated_at: checkedAt,
      }

      const { data: updated, error: writeError } = await supabase
        .from("restock_products")
        .update(patch)
        .eq("id", productId)
        .select("*")
        .single()
      if (writeError) throw writeError

      if (changed || restocked) {
        await supabase.from("restock_events").insert({
          product_id: productId,
          in_stock: snapshot.inStock,
          price: price ?? prev.price,
          source: snapshot.source,
          noted_at: checkedAt,
        })
      }

      return {
        product: mapProduct(updated as DbProduct),
        changed,
        restocked,
      }
    } catch {
      // fall through to memory
    }
  }

  const prev = memoryProducts.get(productId)
  if (!prev) return null
  const restocked = snapshot.inStock === true && prev.inStock !== true
  const changed = prev.inStock !== snapshot.inStock || (price != null && price !== prev.price)
  const next: RestockProduct = {
    ...prev,
    inStock: snapshot.inStock,
    price: price ?? prev.price,
    lastCheckedAt: checkedAt,
    lastSource: snapshot.source,
    lastRestockAt: restocked ? checkedAt : prev.lastRestockAt,
    updatedAt: checkedAt,
  }
  memoryProducts.set(productId, next)
  return { product: next, changed, restocked }
}

/** Dev/test helper when Supabase table is missing. */
export function upsertMemoryProduct(product: RestockProduct) {
  memoryProducts.set(product.id, product)
}
