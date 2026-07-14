import "server-only"
import { createHash } from "crypto"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { isMainlinePokemonTcg, isRecentSetRelease } from "@/lib/pokemon-tcg-filter"
import {
  defaultEbayQueries,
  fetchEbaySoldComps,
  filterSoldItems,
  type EbaySoldItem,
} from "@/lib/ebay-sold"
import { refreshBuyoutAnomaliesFromDatabase } from "@/lib/buyout-radar/store"
import { SEED_BUYOUT_CARDS } from "@/lib/buyout-radar/seed"
import type { BuyoutAlert, BuyoutCard, BuyoutSale } from "@/lib/buyout-radar/types"

/** Per-run batch size. ~1.1s/card → ~200 cards fits Vercel maxDuration 300s. */
const DEFAULT_BATCH_SIZE = 200
const SOLD_LOOKBACK_DAYS = 30
const REQUEST_GAP_MS = 1100
/** Soft deadline so we finish detection/persist before the route times out. */
const RUN_BUDGET_MS = 270_000

export type BuyoutScanResult = {
  ok: true
  scannedAt: string
  /** Cards in the full market universe (catalog). */
  marketUniverseSize: number
  /** Offset into the universe for this batch. */
  batchOffset: number
  /** Next offset for the following cron run. */
  nextOffset: number
  cardsTargeted: number
  cardsScanned: number
  salesIngested: number
  alertCount: number
  alerts: BuyoutAlert[]
  errors: string[]
  source: "ebay-sold"
  coverageNote: string
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Cards scraped per run. Prefer BUYOUT_SCAN_BATCH_SIZE (default 200).
 * Intentionally ignores BUYOUT_SCAN_LIMIT — that env is often still set to
 * the old chase-mode "40" on Vercel and was capping full-market scans.
 */
function resolveBatchSize(explicit?: number): number {
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) {
    return Math.min(2000, Math.floor(explicit))
  }
  const raw = Number(process.env.BUYOUT_SCAN_BATCH_SIZE?.trim() || DEFAULT_BATCH_SIZE)
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_BATCH_SIZE
  return Math.min(2000, Math.floor(raw))
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

type SlabCardRow = {
  id: string
  name: string
  set_name: string
  card_number: string
  rarity: string | null
  image_large: string | null
  release_date: string | null
}

/**
 * Full market universe: every mainline Pokémon TCG card in `slab_cards`
 * (recent sets when age filter is on). Not limited to a 40-card chase list.
 */
export async function loadBuyoutScanUniverse(): Promise<BuyoutCard[]> {
  const byId = new Map<string, BuyoutCard>()

  for (const seed of SEED_BUYOUT_CARDS) {
    byId.set(seed.id, seed)
  }

  if (!isSupabaseConfigured()) {
    return [...byId.values()]
  }

  const admin = createAdminClient()
  const pageSize = 1000
  let from = 0

  for (;;) {
    const { data, error } = await admin
      .from("slab_cards")
      .select("id, name, set_name, card_number, rarity, image_large, release_date")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.warn("[buyout-scan] slab_cards load failed:", error.message)
      break
    }

    const rows = (data ?? []) as SlabCardRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      if (
        !isMainlinePokemonTcg({
          setName: row.set_name,
          genre: "Pokemon Card",
          productName: row.name,
        })
      ) {
        continue
      }
      if (!isRecentSetRelease(row.release_date)) continue
      if (byId.has(row.id)) continue

      const label = row.rarity ? `${row.name} (${row.rarity})` : row.name
      byId.set(row.id, {
        id: row.id,
        name: label,
        setName: row.set_name,
        releaseDate: row.release_date,
        imageUrl: row.image_large,
      })
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return [...byId.values()]
}

async function readScanCursor(): Promise<number> {
  if (!isSupabaseConfigured()) return 0
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("buyout_scan_state")
      .select("cursor_offset")
      .eq("id", 1)
      .maybeSingle()
    if (error || !data) return 0
    const offset = Number((data as { cursor_offset: number }).cursor_offset)
    return Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0
  } catch {
    return 0
  }
}

async function writeScanCursor(offset: number, universeSize: number): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    const admin = createAdminClient()
    await admin.from("buyout_scan_state").upsert(
      {
        id: 1,
        cursor_offset: offset,
        last_universe_size: universeSize,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
  } catch (error) {
    console.warn("[buyout-scan] failed to persist cursor:", error)
  }
}

function sliceBatch(
  universe: BuyoutCard[],
  offset: number,
  size: number,
): { batch: BuyoutCard[]; nextOffset: number } {
  if (universe.length === 0) return { batch: [], nextOffset: 0 }
  const start = offset % universe.length
  const end = Math.min(start + size, universe.length)
  const batch = universe.slice(start, end)
  const nextOffset = end >= universe.length ? 0 : end
  return { batch, nextOffset }
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
  // Empty scrapes (API flake / rate limit) must not wipe prior history.
  if (sales.length === 0) return 0

  const admin = createAdminClient()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - SOLD_LOOKBACK_DAYS)

  await admin
    .from("buyout_sales_transactions")
    .delete()
    .eq("card_id", cardId)
    .gte("purchased_at", since.toISOString())

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

async function scrapeCardSales(apiKey: string, card: BuyoutCard): Promise<BuyoutSale[]> {
  const numberGuess = card.id.includes("-") ? card.id.split("-").pop() || "" : ""
  const queries = defaultEbayQueries({
    cardName: card.name.replace(/\s+\([^)]+\)\s*$/, "").trim() || card.name,
    cardNumber: numberGuess,
    searchQuery: `${card.name} ${card.setName} pokemon`,
  })
  const data = await fetchEbaySoldComps(apiKey, queries.raw, {
    daysToScrape: SOLD_LOOKBACK_DAYS,
  })
  const rawItems = filterSoldItems(data.items ?? [], "raw")
  return salesFromSoldItems(card.id, rawItems)
}

/**
 * Market scan over the full slab_cards catalog (mainline / recent).
 * Each run always re-scrapes the chase seed set first (so liquid cards stay fresh),
 * then advances a cursor through the rest of the catalog.
 */
export async function scanBuyoutMarket(options?: {
  /** Cards to scrape this run (default BUYOUT_SCAN_BATCH_SIZE or 200). */
  limit?: number
  apiKey?: string
  /** If true, ignore saved cursor and start at offset 0. */
  resetCursor?: boolean
}): Promise<BuyoutScanResult> {
  const apiKey = options?.apiKey ?? process.env.EBAY_SOLD_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("EBAY_SOLD_API_KEY is not configured")
  }
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured — cannot persist buyout scan results")
  }

  const size = resolveBatchSize(options?.limit)
  const universe = await loadBuyoutScanUniverse()
  const chaseIds = new Set(SEED_BUYOUT_CARDS.map((c) => c.id))
  const chaseBatch = SEED_BUYOUT_CARDS.map(
    (seed) => universe.find((card) => card.id === seed.id) ?? seed,
  )
  const marketUniverse = universe.filter((card) => !chaseIds.has(card.id))
  const marketBudget = Math.max(0, size - chaseBatch.length)
  const cursor = options?.resetCursor ? 0 : await readScanCursor()
  const { batch: marketBatch, nextOffset } = sliceBatch(
    marketUniverse,
    cursor,
    marketBudget,
  )
  const batch = [...chaseBatch, ...marketBatch]
  console.log(
    `[buyout-scan] universe=${universe.length} chase=${chaseBatch.length} marketBatch=${marketBatch.length} offset=${cursor}`,
  )

  const errors: string[] = []
  let salesIngested = 0
  let cardsScanned = 0
  let marketCardsScanned = 0
  const started = Date.now()

  await upsertBuyoutCards(batch)

  for (let i = 0; i < batch.length; i += 1) {
    if (Date.now() - started > RUN_BUDGET_MS) {
      errors.push(`Time budget reached after ${cardsScanned} cards — remaining cards deferred to next run`)
      const resumedOffset =
        (cursor + marketCardsScanned) % Math.max(marketUniverse.length, 1)
      await writeScanCursor(resumedOffset, universe.length)
      break
    }

    const card = batch[i]!
    const isChase = chaseIds.has(card.id)
    try {
      const sales = await scrapeCardSales(apiKey, card)
      const written = await replaceCardSales(card.id, sales)
      salesIngested += written
      cardsScanned += 1
      if (!isChase) marketCardsScanned += 1
      console.log(
        `[buyout-scan] ${card.name}: ${sales.length} raw sold comps${isChase ? " (chase)" : ""}`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${card.name}: ${message}`)
      console.warn(`[buyout-scan] failed ${card.id}:`, message)
      cardsScanned += 1
      if (!isChase) marketCardsScanned += 1
    }

    if (i < batch.length - 1) await delay(REQUEST_GAP_MS)
  }

  // Advance market cursor only if we finished the planned market slice.
  const finishedMarket =
    marketBatch.length === 0 || marketCardsScanned >= marketBatch.length
  if (finishedMarket) {
    await writeScanCursor(nextOffset, universe.length)
  }

  const alerts = await refreshBuyoutAnomaliesFromDatabase()

  const resumedNext = finishedMarket
    ? nextOffset
    : (cursor + marketCardsScanned) % Math.max(marketUniverse.length, 1)

  const coverageNote =
    universe.length === 0
      ? "No catalog cards available to scan."
      : `Chase-first mode: refreshed ${chaseBatch.length} priority cards + ${marketCardsScanned} catalog cards (market offset ${cursor} → ${resumedNext} of ${marketUniverse.length}). Cron continues through the rest (~${size}/batch).`

  return {
    ok: true,
    scannedAt: new Date().toISOString(),
    marketUniverseSize: universe.length,
    batchOffset: cursor,
    nextOffset: resumedNext,
    cardsTargeted: batch.length,
    cardsScanned,
    salesIngested,
    alertCount: alerts.length,
    alerts,
    errors,
    source: "ebay-sold",
    coverageNote,
  }
}
