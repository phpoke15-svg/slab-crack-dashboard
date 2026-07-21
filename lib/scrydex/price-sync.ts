import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { scrydexOnDemandOnly } from "@/lib/scrydex/constants"
import { SCRYDEX_CACHE } from "@/lib/scrydex/types"
import { CatalogService } from "@/lib/scrydex/catalog-service"
import { scrydexPriceSyncMaxCards } from "@/lib/scrydex/constants"
import { flattenHistoryPoints } from "@/lib/scrydex/adapters"
import { persistHistoryPoints } from "@/lib/scrydex/db"
import { ScrydexClient } from "@/lib/scrydex/client"
import { ScrydexCreditBudgetError } from "@/lib/scrydex/credit-ledger"

export type ScrydexPriceSyncResult = {
  refreshed: number
  historyPoints: number
  creditsUsed: number
  errors: string[]
}

export async function syncScrydexPrices(opts?: {
  maxCards?: number
  includeHistory?: boolean
  historyLimit?: number
}): Promise<ScrydexPriceSyncResult> {
  if (!isSupabaseConfigured()) {
    return { refreshed: 0, historyPoints: 0, creditsUsed: 0, errors: ["Supabase not configured"] }
  }

  const service = new CatalogService()
  const client = ScrydexClient.fromEnv()
  const maxCards = opts?.maxCards ?? scrydexPriceSyncMaxCards()
  const staleBefore = new Date(Date.now() - SCRYDEX_CACHE.priceTtlMs).toISOString()

  const supabase = createAdminClient()
  let queue: Array<{ catalog_id: string; game?: string; scrydex_id?: string }> = []

  if (scrydexOnDemandOnly()) {
    const onDemand = await supabase.rpc("get_on_demand_price_refresh_queue", {
      stale_before: staleBefore,
      row_limit: maxCards,
    })

    if (!onDemand.error) {
      queue = (onDemand.data ?? []) as typeof queue
    } else if (onDemand.error.code === "42883") {
      const fallback = await supabase.rpc("get_price_refresh_queue", {
        stale_before: staleBefore,
        row_limit: maxCards * 3,
      })
      if (fallback.error?.code === "42883") {
        return {
          refreshed: 0,
          historyPoints: 0,
          creditsUsed: 0,
          errors: ["Run supabase/scrydex-batch-rpc.sql to enable refresh queue"],
        }
      }
      if (fallback.error) throw fallback.error

      const activeIds = await loadActiveCatalogIds(supabase)
      queue = ((fallback.data ?? []) as typeof queue).filter((row) =>
        activeIds.has(String(row.catalog_id)),
      ).slice(0, maxCards)
    } else {
      throw onDemand.error
    }
  } else {
    const { data, error } = await supabase.rpc("get_price_refresh_queue", {
      stale_before: staleBefore,
      row_limit: maxCards,
    })

    if (error?.code === "42883") {
      return {
        refreshed: 0,
        historyPoints: 0,
        creditsUsed: 0,
        errors: ["Run supabase/scrydex-batch-rpc.sql to enable refresh queue"],
      }
    }
    if (error) throw error
    queue = (data ?? []) as typeof queue
  }

  let refreshed = 0
  let historyPoints = 0
  let creditsUsed = 0
  const errors: string[] = []

  for (const row of queue) {
    const catalogId = String(row.catalog_id)
    try {
      const result = await service.ensureFreshPrices(catalogId)
      creditsUsed += result.creditsUsed
      if (result.source === "scrydex") refreshed += 1
    } catch (error) {
      if (error instanceof ScrydexCreditBudgetError) {
        errors.push(error.message)
        break
      }
      errors.push(`${catalogId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (opts?.includeHistory) {
    const historyLimit = opts.historyLimit ?? 50
    const { data: historyQueue, error: historyError } = await supabase.rpc("get_history_backfill_queue", {
      row_limit: historyLimit,
    })
    if (historyError && historyError.code !== "42883") throw historyError

    for (const row of historyQueue ?? []) {
      const catalogId = String(row.catalog_id)
      const game = row.game as "pokemon" | "lorcana" | "mtg"
      const scrydexId = String(row.scrydex_id)
      try {
        const remote = await client.getPriceHistory(game, scrydexId, { days: 90 }, { catalogId })
        const points = flattenHistoryPoints(catalogId, remote.data)
        await persistHistoryPoints(catalogId, points)
        historyPoints += points.length
        creditsUsed += 3
      } catch (error) {
        if (error instanceof ScrydexCreditBudgetError) {
          errors.push(error.message)
          break
        }
        errors.push(`history ${catalogId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  return { refreshed, historyPoints, creditsUsed, errors }
}

async function loadActiveCatalogIds(supabase: ReturnType<typeof createAdminClient>) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("card_activity")
    .select("catalog_id")
    .gte("last_seen_at", since)

  if (error?.code === "42P01") return new Set<string>()
  if (error) throw error
  return new Set((data ?? []).map((row) => String(row.catalog_id)))
}

export async function probeScrydexSync(): Promise<{ ok: boolean; message: string }> {
  try {
    if (!process.env.SCRYDEX_API_KEY?.trim() || !process.env.SCRYDEX_TEAM_ID?.trim()) {
      return { ok: false, message: "SCRYDEX_API_KEY / SCRYDEX_TEAM_ID missing" }
    }
    if (!isSupabaseConfigured()) {
      return { ok: false, message: "Supabase not configured" }
    }
    const supabase = createAdminClient()
    const { error } = await supabase.from("catalog_cards").select("catalog_id").limit(1)
    if (error?.code === "42P01") {
      return { ok: false, message: "Run supabase/scrydex-multi-tcg.sql" }
    }
    if (error) return { ok: false, message: error.message }
    return { ok: true, message: "Scrydex pipeline ready" }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
