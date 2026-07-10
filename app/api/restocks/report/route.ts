import { NextResponse } from "next/server"
import {
  getRestockProductByExternal,
  listActiveProductsForSync,
} from "@/lib/restocks/store"
import { applyExternalStockReport } from "@/lib/restocks/sync"
import type { RestockRetailer } from "@/lib/restocks/types"

export const dynamic = "force-dynamic"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Restock-Secret",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

type ReportBody = {
  retailer?: RestockRetailer
  externalId?: string
  productUrl?: string
  inStock?: boolean
  price?: number
  source?: string
}

/**
 * Pokemon Center (and optional manual) stock reports.
 * Called from the mobile WebView inject / bookmarklet after Imperva is passed.
 * Optional shared secret: RESTOCKS_REPORT_SECRET via X-Restock-Secret.
 */
export async function POST(request: Request) {
  const requiredSecret = process.env.RESTOCKS_REPORT_SECRET?.trim()
  if (requiredSecret) {
    const provided = request.headers.get("x-restock-secret")?.trim()
    if (provided !== requiredSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS })
    }
  }

  let body: ReportBody
  try {
    body = (await request.json()) as ReportBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS })
  }

  if (typeof body.inStock !== "boolean") {
    return NextResponse.json({ error: "inStock boolean required" }, { status: 400, headers: CORS_HEADERS })
  }

  const retailer: RestockRetailer =
    body.retailer === "walmart" || body.retailer === "pokemon_center"
      ? body.retailer
      : "pokemon_center"

  let product =
    body.externalId != null && body.externalId.length > 0
      ? await getRestockProductByExternal(retailer, body.externalId)
      : null

  if (!product && body.productUrl) {
    const all = await listActiveProductsForSync(retailer)
    const normalized = body.productUrl.split("?")[0].replace(/\/$/, "")
    product =
      all.find((p) => p.productUrl.split("?")[0].replace(/\/$/, "") === normalized) ??
      all.find((p) => normalized.includes(p.externalId) || p.productUrl.includes(normalized)) ??
      null
  }

  if (!product) {
    return NextResponse.json(
      { error: "No matching active restock product. Add the SKU in Supabase first." },
      { status: 404, headers: CORS_HEADERS },
    )
  }

  try {
    const result = await applyExternalStockReport(product, {
      inStock: body.inStock,
      price: typeof body.price === "number" ? body.price : null,
      source: body.source ?? (retailer === "pokemon_center" ? "pc_report" : "manual_report"),
    })
    return NextResponse.json(
      { ok: true, restocked: result.restocked, product: result.product },
      { headers: CORS_HEADERS },
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Report failed" },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
