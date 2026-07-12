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

async function loadFromDatabase(): Promise<{
  cards: BuyoutCard[]
  sales: BuyoutSale[]
} | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const admin = createAdminClient()
    const since = new Date()
    since.setUTCDate(since.getUTCDate() - 16)

    const [{ data: cards, error: cardError }, { data: sales, error: saleError }] =
      await Promise.all([
        admin.from("buyout_cards").select("id, name, set_name, release_date, image_url"),
        admin
          .from("buyout_sales_transactions")
          .select(
            "id, card_id, quantity_purchased, total_price, buyer_ip_hash, purchased_at",
          )
          .gte("purchased_at", since.toISOString())
          .order("purchased_at", { ascending: true }),
      ])

    if (cardError || saleError) {
      // Tables may not exist until buyout-radar.sql is applied.
      console.warn(
        "[buyout-radar] DB load failed, using seed:",
        cardError?.message || saleError?.message,
      )
      return null
    }

    if (!cards || cards.length === 0) return null

    return {
      cards: (cards as DbCardRow[]).map(mapCard),
      sales: ((sales ?? []) as DbSaleRow[]).map(mapSale),
    }
  } catch (error) {
    console.warn("[buyout-radar] DB unavailable:", error)
    return null
  }
}

export async function getBuyoutRadarFeed(): Promise<BuyoutRadarResponse> {
  const db = await loadFromDatabase()
  const source = db ? "database" : "seed"
  const cards = db?.cards ?? SEED_BUYOUT_CARDS
  const sales = db?.sales ?? buildSeedBuyoutSales()
  const alerts = detectBuyoutRisks(cards, sales)

  return {
    ok: true,
    source,
    asOf: new Date().toISOString(),
    alertCount: alerts.length,
    alerts,
  }
}

/** Optional: persist detector hits when SQL migration is live. */
export async function persistBuyoutAnomalies(alerts: BuyoutAlert[]): Promise<number> {
  if (!isSupabaseConfigured() || alerts.length === 0) return 0

  try {
    const admin = createAdminClient()
    await admin.from("buyout_anomalies_log").update({ active: false }).eq("active", true)

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
