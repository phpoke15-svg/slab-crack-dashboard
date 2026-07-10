import crypto from "crypto"
import type { StockSnapshot } from "@/lib/restocks/types"

/**
 * Walmart Affiliate Product API (v2 items).
 * Docs: https://walmart.io/apidocs/affiliates/affiliate-marketing-api
 *
 * Required env:
 *   WALMART_AFFILIATE_CONSUMER_ID
 *   WALMART_AFFILIATE_PRIVATE_KEY  (PEM, PKCS8 — newlines as \n in Vercel)
 *   WALMART_AFFILIATE_PUBLISHER_ID (Impact / publisher id)
 * Optional:
 *   WALMART_AFFILIATE_KEY_VERSION  (default "1")
 */

const AFFILIATE_BASE =
  process.env.WALMART_AFFILIATE_API_BASE?.replace(/\/$/, "") ||
  "https://developer.api.walmart.com/api-proxy/service/affil/product/v2"

export function isWalmartAffiliateConfigured(): boolean {
  return Boolean(
    process.env.WALMART_AFFILIATE_CONSUMER_ID?.trim() &&
      process.env.WALMART_AFFILIATE_PRIVATE_KEY?.trim() &&
      process.env.WALMART_AFFILIATE_PUBLISHER_ID?.trim(),
  )
}

function normalizePrivateKey(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.includes("BEGIN")) {
    return trimmed.replace(/\\n/g, "\n")
  }
  // Bare base64 body → wrap as PKCS8 PEM
  return `-----BEGIN PRIVATE KEY-----\n${trimmed}\n-----END PRIVATE KEY-----`
}

function authHeaders(): Record<string, string> {
  const consumerId = process.env.WALMART_AFFILIATE_CONSUMER_ID!.trim()
  const privateKey = normalizePrivateKey(process.env.WALMART_AFFILIATE_PRIVATE_KEY!)
  const keyVersion = process.env.WALMART_AFFILIATE_KEY_VERSION?.trim() || "1"
  const timestamp = Date.now().toString()
  const data = consumerId + "\n" + timestamp + "\n" + keyVersion + "\n"
  const signer = crypto.createSign("RSA-SHA256")
  signer.update(data)
  signer.end()
  const signature = signer.sign(privateKey, "base64")

  return {
    Accept: "application/json",
    "WM_SEC.AUTH_SIGNATURE": signature,
    "WM_SEC.KEY_VERSION": keyVersion,
    "WM_CONSUMER.ID": consumerId,
    "WM_CONSUMER.INTIMESTAMP": timestamp,
  }
}

function parseAvailability(item: Record<string, unknown>): boolean {
  const stock = String(item.stock ?? item.availabilityStatus ?? item.availableOnline ?? "").toLowerCase()
  if (stock.includes("in stock") || stock === "available" || stock === "true") return true
  if (stock.includes("out of stock") || stock === "unavailable" || stock === "false") return false

  // Common affiliate payload shapes
  if (typeof item.availableOnline === "boolean") return item.availableOnline
  if (item.stock === "Available") return true
  return false
}

function parsePrice(item: Record<string, unknown>): number | null {
  const sale = item.salePrice ?? item.price
  if (typeof sale === "number" && sale > 0) return sale
  if (sale && typeof sale === "object" && "amount" in (sale as object)) {
    const amount = Number((sale as { amount?: unknown }).amount)
    return amount > 0 ? amount : null
  }
  const n = Number(sale)
  return n > 0 ? n : null
}

export async function fetchWalmartItemStock(itemId: string): Promise<StockSnapshot> {
  if (!isWalmartAffiliateConfigured()) {
    throw new Error("Walmart Affiliate API is not configured")
  }
  if (!itemId || itemId.startsWith("REPLACE_")) {
    throw new Error("Invalid Walmart item id")
  }

  const publisherId = process.env.WALMART_AFFILIATE_PUBLISHER_ID!.trim()
  const url = `${AFFILIATE_BASE}/items/${encodeURIComponent(itemId)}?publisherId=${encodeURIComponent(publisherId)}`

  const response = await fetch(url, {
    headers: authHeaders(),
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Walmart API ${response.status}: ${body.slice(0, 200)}`)
  }

  const json = (await response.json()) as Record<string, unknown> | { items?: Record<string, unknown>[] }
  const item = Array.isArray((json as { items?: unknown }).items)
    ? ((json as { items: Record<string, unknown>[] }).items[0] ?? {})
    : (json as Record<string, unknown>)

  return {
    inStock: parseAvailability(item),
    price: parsePrice(item),
    source: "walmart_affiliate",
    checkedAt: new Date().toISOString(),
  }
}
