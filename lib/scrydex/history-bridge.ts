import { resolveCatalogId } from "@/lib/scrydex/constants"
import { createCatalogService } from "@/lib/scrydex/catalog-service"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { PriceHistoryPoint } from "@/lib/pricing/types"

export async function loadScrydexHistoryFromDb(
  cardId: string,
  days: number,
): Promise<PriceHistoryPoint[]> {
  if (!isSupabaseConfigured()) return []

  const catalogId = resolveCatalogId(cardId)
  if (!catalogId) return []

  const supabase = createAdminClient()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)

  const { data, error } = await supabase
    .from("price_history_daily")
    .select("snapshot_date, market_price, price_type, variant, condition, company, grade")
    .eq("catalog_id", catalogId)
    .gte("snapshot_date", since.toISOString().slice(0, 10))
    .order("snapshot_date", { ascending: true })

  if (error?.code === "42P01") return []
  if (error) throw error

  const points: PriceHistoryPoint[] = []
  for (const row of data ?? []) {
    const snapshotDate = String(row.snapshot_date)
    const price = Number(row.market_price ?? 0)
    if (price <= 0) continue

    if (row.price_type === "graded" && row.company === "PSA" && String(row.grade) === "10") {
      points.push({ cardId, snapshotDate, grade: 10, price, source: "scrydex" })
    } else if (
      row.price_type === "raw" &&
      (row.variant ?? "normal") === "normal" &&
      (row.condition ?? "NM") === "NM"
    ) {
      points.push({ cardId, snapshotDate, grade: 0, price, source: "scrydex" })
    }
  }
  return points
}

export async function ensureScrydexHistoryCached(
  cardId: string,
  days: number,
): Promise<{ points: PriceHistoryPoint[]; fetched: boolean }> {
  const existing = await loadScrydexHistoryFromDb(cardId, days)
  if (existing.length >= 2) {
    return { points: existing, fetched: false }
  }

  const catalogId = resolveCatalogId(cardId)
  if (!catalogId) return { points: existing, fetched: false }

  try {
    const service = createCatalogService()
    await service.ensureHistory(catalogId, days)
    const refreshed = await loadScrydexHistoryFromDb(cardId, days)
    return { points: refreshed, fetched: refreshed.length > 0 }
  } catch (error) {
    console.warn("[scrydex/history-bridge] fetch failed:", cardId, error)
    return { points: existing, fetched: false }
  }
}
