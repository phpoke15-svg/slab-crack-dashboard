import { NextResponse } from "next/server"
import { listRestockProducts } from "@/lib/restocks/store"
import { isWalmartAffiliateConfigured } from "@/lib/restocks/walmart"
import type { RestockRetailer } from "@/lib/restocks/types"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const retailer = url.searchParams.get("retailer") as RestockRetailer | null
  const inStockOnly = url.searchParams.get("inStock") === "1"

  const products = await listRestockProducts({
    retailer: retailer === "walmart" || retailer === "pokemon_center" ? retailer : undefined,
    inStockOnly,
  })

  return NextResponse.json({
    products,
    meta: {
      walmartConfigured: isWalmartAffiliateConfigured(),
      count: products.length,
      checkedAt: new Date().toISOString(),
    },
  })
}
