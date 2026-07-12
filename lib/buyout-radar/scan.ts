import "server-only"
import { createHash } from "crypto"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { getCatalogFeedFromDb } from "@/lib/db/catalog-feed"
import { getWatchlistFromDb } from "@/lib/db/watchlist"
import {
  defaultEbayQueries,
  fetchEbaySoldComps,
  filterSoldItems,
  type EbaySoldItem,
} from "@/lib/ebay-sold"
import { detectBuyoutRisks } from "@/lib/buyout-radar/detect"
import { persistBuyoutAnomalies } from "@/lib/buyout-radar/store"
import { SEED_BUYOUT_CARDS } from "@/lib/buyout-radar/seed"
import type { BuyoutAlert, BuyoutCard, BuyoutSale } from "@/lib/buyout-radar/types"
import { TOP_CARDS_LIMIT } from "@/lib/top-cards"

const DEFAULT_SCAN_LIMIT = 40
const SOLD_LOOKBACK_DAYS = 30
const REQUEST_GAP_MS = 1100

export type BuyoutScanResult = {
  ok: true
  scannedAt: string
  cardsTargeted: number
  cardsScanned: number
  salesIngested: number
  alertCount: number
  alerts: BuyoutAlert[]
  errors: string[]
  source: "ebay-sold"
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function scanLimit(): number {
  const raw = Number(process.env.BUYOUT_SCAN_LIMIT?.trim() || DEFAULT_SCAN_LIMIT)
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_SCAN_LIMIT
  return Math.min(TOP_CARDS_LIMIT, Math.floor(raw))
}

function listingFingerprint(item: EbaySoldItem): string {
  const key = `${item.url || item.title}|${item.endedAt || ""}|${item.soldPrice}|${item.shippingPrice || ""}`
  return `mkt-${createHash("sha256").update(key).digest("hex").slice(0, 20)}`
}

function itemUnitPrice(item: EbaySoldItem): number {
  const sold = Number.parseFloat(item.soldPrice)
  const ship = Number.parseFloat(item.shippingPrice ?? "0")
  if (!Number.isFinite(sold) || sold <= 0) return 0
  return sold + (Number.isFinite(ship) ? ship : 0)
}

function itemPurchasedAt(item: EbaySoldItem): string | null {
  if (!item.endedAt?.trim()) return null
  const t = Date.parse(item.endedAt)
  if (!Number.isFinite(t)) return null
  return new Date(t).toISOString()
}

/** Prefer high-value chase cards from catalog/watchlist for the daily scan universe. */
export async function loadBuyoutScanUniverse(limit = scanLimit()): Promise<BuyoutCard[]> {
  const byId = new Map<string, BuyoutCard>()

  for (const seed of SEED_BUYOUT_CARDS) {
    byId.set(seed.id, seed)
  }

  if (isSupabaseConfigured()) {
    try {
      const watchlist = await getWatchlistFromDb()
      for (const entry of watchlist) {
        const id = entry.pokemonTcgId?.trim() || entry.id
        if (!id || byId.has(id)) continue
        byId.set(id, {
          id,
          name: entry.cardName.replace(/\s+\([^)]+\)\s*$/, "").trim() || entry.cardName,
          setName: entry.setName,
          releaseDate: null,
          imageUrl: entry.imageUrl || null,
        })
      }
    } catch (error) {
      console.warn("[buyout-scan] watchlist load failed:", error)
    }

    try {
      const feed = await getCatalogFeedFromDb()
      const priced = feed
        .filter((c) => (c.rawPrice ?? 0) > 0)
        .sort((a, b) => (b.rawPrice ?? 0) - (a.rawPrice ?? 0))

      for (const entry of priced) {
        const id = entry.pokemonTcgId?.trim() || entry.id
        if (!id || byId.has(id)) continue
        byId.set(id, {
          id,
          name: entry.cardName.replace(/\s+\([^)]+\)\s*$/, "").trim() || entry.cardName,
          setName: entry.setName,
          releaseDate: entry.releaseDate ?? null,
          imageUrl: entry.imageUrl || null,
        })
        if (byId.size >= Math.max(limit * 3, limit)) break
      }
    } catch (error) {
      console.warn("[buyout-scan] catalog load failed:", error)
    }
  }

  return [...byId.values()].slice(0, limit)
}

async function upsertBuyoutCards(cards: BuyoutCard[]): Promise<void> {
  if (!isSupabaseConfigured() || cards.length === 0) return
  const admin = createAdminClient()
  const rows = cards.map((c) => ({
    id: c.id,
    name: c.name,
    set_name: c.setName,
    release_date: c.releaseDate,
    image_url: c.imageUrl,
  }))
  const { error } = await admin.from("buyout_cards").upsert(rows, { onConflict: "id" })
  if (error) throw new Error(`Failed to upsert buyout_cards: ${error.message}`)
}

async function replaceCardSales(cardId: string, sales: BuyoutSale[]): Promise<number> {
  if (!isSupabaseConfigured()) return 0
  const admin = createAdminClient()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - SOLD_LOOKBACK_DAYS)

  await admin
    .from("buyout_sales_transactions")
    .delete()
    .eq("card_id", cardId)
    .gte("purchased_at", since.toISOString())

  if (sales.length === 0) return 0

  const rows = sales.map((s) => ({
    card_id: s.cardId,
    quantity_purchased: s.quantityPurchased,
    total_price: s.totalPrice,
    buyer_ip_hash: s.buyerIpHash,
    purchased_at: s.purchasedAt,
  }))

  const { error } = await admin.from("buyout_sales_transactions").insert(rows)
  if (error) throw new Error(`Failed to insert sales for ${cardId}: ${error.message}`)
  return rows.length
}

function salesFromSoldItems(cardId: string, items: EbaySoldItem[]): BuyoutSale[] {
  const out: BuyoutSale[] = []
  for (const item of items) {
    const purchasedAt = itemPurchasedAt(item)
    const totalPrice = itemUnitPrice(item)
    if (!purchasedAt || totalPrice <= 0) continue
    out.push({
      id: listingFingerprint(item),
      cardId,
      quantityPurchased: 1,
      totalPrice: Math.round(totalPrice * 100) / 100,
      buyerIpHash: listingFingerprint(item),
      purchasedAt,
    })
  }
  return out
}

async function scrapeCardSales(
  apiKey: string,
  card: BuyoutCard,
): Promise<BuyoutSale[]> {
  const queries = defaultEbayQueries({
    cardName: card.name,
    cardNumber: card.id.includes("-") ? card.id.split("-").pop() || "" : "",
    searchQuery: `${card.name} ${card.setName} pokemon`,
  })
  const data = await fetchEbaySoldComps(apiKey, queries.raw, {
    daysToScrape: SOLD_LOOKBACK_DAYS,
  })
  const rawItems = filterSoldItems(data.items ?? [], "raw")
  return salesFromSoldItems(card.id, rawItems)
}

/**
 * Daily market scan: scrape raw NM sold comps for the chase universe,
 * ingest as transactions, then classify Critical / High / Warning by volume spike.
 */
export async function scanBuyoutMarket(options?: {
  limit?: number
  apiKey?: string
}): Promise<BuyoutScanResult> {
  const apiKey = options?.apiKey ?? process.env.EBAY_SOLD_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("EBAY_SOLD_API_KEY is not configured")
  }
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured — cannot persist buyout scan results")
  }

  const limit = options?.limit ?? scanLimit()
  const universe = await loadBuyoutScanUniverse(limit)
  const errors: string[] = []
  let salesIngested = 0
  let cardsScanned = 0
  const scannedCards: BuyoutCard[] = []
  const allSales: BuyoutSale[] = []

  await upsertBuyoutCards(universe)

  for (let i = 0; i < universe.length; i += 1) {
    const card = universe[i]!
    try {
      const sales = await scrapeCardSales(apiKey, card)
      const written = await replaceCardSales(card.id, sales)
      salesIngested += written
      cardsScanned += 1
      scannedCards.push(card)
      allSales.push(...sales)
      console.log(
        `[buyout-scan] ${i + 1}/${universe.length} ${card.name}: ${sales.length} raw sold comps`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${card.name}: ${message}`)
      console.warn(`[buyout-scan] failed ${card.id}:`, message)
    }

    if (i < universe.length - 1) await delay(REQUEST_GAP_MS)
  }

  const alerts = detectBuyoutRisks(scannedCards, allSales, {
    marketVolumeOnly: true,
  })
  await persistBuyoutAnomalies(alerts)

  return {
    ok: true,
    scannedAt: new Date().toISOString(),
    cardsTargeted: universe.length,
    cardsScanned,
    salesIngested,
    alertCount: alerts.length,
    alerts,
    errors,
    source: "ebay-sold",
  }
}
