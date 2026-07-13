import "server-only"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { detectBuyoutRisks } from "@/lib/buyout-radar/detect"
import { buildSeedBuyoutSales, SEED_BUYOUT_CARDS } from "@/lib/buyout-radar/seed"
import type {
  BuyoutAlert,
  BuyoutCard,
  BuyoutRadarResponse,
  BuyoutSale,
  RecommendedAction,
  BuyoutPriority,
} from "@/lib/buyout-radar/types"

type DbCardRow = {
  id: string
  name: string
  set_name: string
  release_date: string | null
  image_url: string | null
}

type DbSaleRow = {
  id: string
  card_id: string
  quantity_purchased: number
  total_price: number
  buyer_ip_hash: string
  purchased_at: string
}

function mapCard(row: DbCardRow): BuyoutCard {
  return {
    id: row.id,
    name: row.name,
    setName: row.set_name,
    releaseDate: row.release_date,
    imageUrl: row.image_url,
  }
}

function mapSale(row: DbSaleRow): BuyoutSale {
  return {
    id: row.id,
    cardId: row.card_id,
    quantityPurchased: Number(row.quantity_purchased),
    totalPrice: Number(row.total_price),
    buyerIpHash: row.buyer_ip_hash,
    purchasedAt: row.purchased_at,
  }
}

/** Load all buyout cards + recent sales from Supabase (paged). */
export async function loadBuyoutMarketFromDatabase(): Promise<{
  cards: BuyoutCard[]
  sales: BuyoutSale[]
} | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const admin = createAdminClient()
    const since = new Date()
    since.setUTCDate(since.getUTCDate() - 16)

    const cards: BuyoutCard[] = []
    const sales: BuyoutSale[] = []
    const pageSize = 1000

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await admin
        .from("buyout_cards")
        .select("id, name, set_name, release_date, image_url")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) {
        console.warn("[buyout-radar] DB load failed, using seed:", error.message)
        return null
      }
      const rows = (data ?? []) as DbCardRow[]
      if (rows.length === 0) break
      cards.push(...rows.map(mapCard))
      if (rows.length < pageSize) break
    }

    if (cards.length === 0) return null

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await admin
        .from("buyout_sales_transactions")
        .select(
          "id, card_id, quantity_purchased, total_price, buyer_ip_hash, purchased_at",
        )
        .gte("purchased_at", since.toISOString())
        .order("purchased_at", { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) {
        console.warn("[buyout-radar] DB load failed, using seed:", error.message)
        return null
      }
      const rows = (data ?? []) as DbSaleRow[]
      if (rows.length === 0) break
      sales.push(...rows.map(mapSale))
      if (rows.length < pageSize) break
    }

    return { cards, sales }
  } catch (error) {
    console.warn("[buyout-radar] DB unavailable:", error)
    return null
  }
}

async function loadScanProgress(): Promise<{
  cursorOffset: number
  marketUniverseSize: number
} | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("buyout_scan_state")
      .select("cursor_offset, last_universe_size")
      .eq("id", 1)
      .maybeSingle()
    if (error || !data) return null
    const row = data as { cursor_offset: number; last_universe_size: number }
    return {
      cursorOffset: Number(row.cursor_offset) || 0,
      marketUniverseSize: Number(row.last_universe_size) || 0,
    }
  } catch {
    return null
  }
}

function defaultBatchSize(): number {
  const raw = Number(process.env.BUYOUT_SCAN_BATCH_SIZE?.trim() || 200)
  if (!Number.isFinite(raw) || raw <= 0) return 200
  return Math.min(2000, Math.floor(raw))
}

export async function getBuyoutRadarFeed(): Promise<BuyoutRadarResponse> {
  const [db, progress] = await Promise.all([
    loadBuyoutMarketFromDatabase(),
    loadScanProgress(),
  ])
  const sales = db?.sales ?? buildSeedBuyoutSales()
  const cards = db?.cards ?? SEED_BUYOUT_CARDS
  const marketDerived = sales.some((s) => s.buyerIpHash.startsWith("mkt-"))
  const source = !db ? "seed" : marketDerived ? "market-scan" : "database"

  const alerts = detectBuyoutRisks(cards, sales, {
    // Public sold comps have no buyer IDs — classify live scans by volume spike.
    marketVolumeOnly: marketDerived,
  })

  const lastSale = sales.reduce<string | null>((latest, s) => {
    if (!latest || s.purchasedAt > latest) return s.purchasedAt
    return latest
  }, null)

  return {
    ok: true,
    source,
    asOf: new Date().toISOString(),
    alertCount: alerts.length,
    alerts,
    scan: {
      cardsScanned: cards.length,
      salesIngested: sales.length,
      lastScanAt: source === "seed" ? null : lastSale,
      mode: source === "seed" ? "demo" : "live",
      marketUniverseSize: progress?.marketUniverseSize,
      cursorOffset: progress?.cursorOffset,
      batchSize: defaultBatchSize(),
    },
  }
}

/**
 * Re-run detection across every card with stored sales and refresh anomalies_log.
 * Used after each batch ingest so alerts aren't wiped to only the latest batch.
 */
export async function refreshBuyoutAnomaliesFromDatabase(): Promise<BuyoutAlert[]> {
  const db = await loadBuyoutMarketFromDatabase()
  if (!db) return []
  const marketDerived = db.sales.some((s) => s.buyerIpHash.startsWith("mkt-"))
  const alerts = detectBuyoutRisks(db.cards, db.sales, {
    marketVolumeOnly: marketDerived,
  })
  await persistBuyoutAnomalies(alerts)
  return alerts
}

/** Persist detector hits when SQL migration is live. Clears prior active rows. */
export async function persistBuyoutAnomalies(alerts: BuyoutAlert[]): Promise<number> {
  if (!isSupabaseConfigured()) return 0

  try {
    const admin = createAdminClient()
    await admin.from("buyout_anomalies_log").update({ active: false }).eq("active", true)

    if (alerts.length === 0) return 0

    const rows = alerts.map((a) => ({
      card_id: a.cardId,
      priority: a.priority as BuyoutPriority,
      recommended_action: a.recommendedAction as RecommendedAction,
      current_volume: a.currentVolume,
      baseline_volume: a.baselineVolume,
      volume_multiple: a.volumeMultiple,
      unique_buyers: a.uniqueBuyers,
      buyer_concentration_index: a.buyerConcentrationIndex,
      buyout_probability_percentage: a.buyoutProbabilityPercentage,
      window_hours: 24,
      notes: a.notes,
      active: true,
      detected_at: a.detectedAt,
    }))

    const { error } = await admin.from("buyout_anomalies_log").insert(rows)
    if (error) {
      console.warn("[buyout-radar] persist failed:", error.message)
      return 0
    }
    return rows.length
  } catch (error) {
    console.warn("[buyout-radar] persist unavailable:", error)
    return 0
  }
}
