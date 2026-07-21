import { ensureCardDailyPriceHistory } from "@/lib/pricing/card-daily-price-history"
import { ScrydexClient } from "@/lib/scrydex/client"
import {
  catalogIdToLegacyPokeId,
  isScrydexConfigured,
  resolveCatalogId,
  splitCatalogId,
} from "@/lib/scrydex/constants"
import { ScrydexCreditBudgetError } from "@/lib/scrydex/credit-ledger"
import { getCatalogCard, loadCardBundle, persistCardPricingBundle } from "@/lib/scrydex/db"
import { scrydexBundleToCardPriceRow } from "@/lib/scrydex/price-adapter"
import { upsertWebhookDailyHistory } from "@/lib/scrydex/webhook-history"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { allPromoCardMeta } from "@/lib/trade-binder/promo-card-meta"

export type RepairScrydexPricesResult = {
  attempted: number
  refreshed: number
  cardsUpdated: number
  historyBackfilled: number
  historyRows: number
  creditsUsed: number
  results: Array<{
    catalogId: string
    scrydexId: string | null
    raw: number | null
    psa10: number | null
    refreshed: boolean
    cardsUpdated: boolean
    error?: string
  }>
  errors: string[]
}

export function resolveRepairCatalogIds(input: {
  ids?: string[]
  includePromos?: boolean
  maxCards?: number
}): string[] {
  const catalogIds = new Set<string>()

  if (input.includePromos !== false) {
    for (const promo of allPromoCardMeta()) {
      const catalogId = resolveCatalogId(promo.id)
      if (catalogId) catalogIds.add(catalogId)
    }
  }

  for (const id of input.ids ?? []) {
    const trimmed = id.trim()
    if (!trimmed) continue
    const catalogId = resolveCatalogId(trimmed)
    if (catalogId) catalogIds.add(catalogId)
  }

  const maxCards = input.maxCards ?? 32
  return [...catalogIds].slice(0, maxCards)
}

async function forceRefreshCatalogCard(catalogId: string): Promise<{ refreshed: boolean; creditsUsed: number }> {
  const parts = splitCatalogId(catalogId)
  if (!parts) return { refreshed: false, creditsUsed: 0 }

  const existing = await getCatalogCard(catalogId)
  const game = existing?.game ?? parts.game
  const scrydexId = existing?.scrydex_id ?? parts.scrydexId

  const client = ScrydexClient.fromEnv()
  const remote = await client.getCard(game, scrydexId, {
    includePrices: true,
    catalogId,
  })

  if (!remote.data) return { refreshed: false, creditsUsed: 0 }

  await persistCardPricingBundle(game, remote.data)
  return { refreshed: true, creditsUsed: 1 }
}

async function syncPublicCardsRowFromCatalog(catalogId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const bundle = await loadCardBundle(catalogId)
  if (!bundle?.card?.scrydex_id) return false

  const priceRow = scrydexBundleToCardPriceRow({
    card: bundle.card,
    raw: bundle.raw as never[],
    graded: bundle.graded as never[],
    legacyCardId: catalogIdToLegacyPokeId(catalogId) ?? undefined,
  })
  if (!priceRow) return false

  const now = new Date().toISOString()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("cards")
    .update({
      current_price_raw: priceRow.raw_price,
      current_price_psa10: priceRow.psa10_price,
      price_updated_at: now,
      updated_at: now,
    })
    .eq("scrydex_id", bundle.card.scrydex_id)
    .select("id")

  if (error?.code === "42P01") return false
  if (error) throw error
  return (data ?? []).length > 0
}

export async function repairScrydexCatalogPrices(opts?: {
  ids?: string[]
  includePromos?: boolean
  maxCards?: number
  includeHistory?: boolean
}): Promise<RepairScrydexPricesResult> {
  if (!isScrydexConfigured()) {
    return {
      attempted: 0,
      refreshed: 0,
      cardsUpdated: 0,
      historyBackfilled: 0,
      historyRows: 0,
      creditsUsed: 0,
      results: [],
      errors: ["SCRYDEX_API_KEY / SCRYDEX_TEAM_ID not configured"],
    }
  }

  if (!isSupabaseConfigured()) {
    return {
      attempted: 0,
      refreshed: 0,
      cardsUpdated: 0,
      historyBackfilled: 0,
      historyRows: 0,
      creditsUsed: 0,
      results: [],
      errors: ["Supabase not configured"],
    }
  }

  const catalogIds = resolveRepairCatalogIds(opts ?? {})
  const results: RepairScrydexPricesResult["results"] = []
  const errors: string[] = []
  let refreshed = 0
  let cardsUpdated = 0
  let historyBackfilled = 0
  let historyRows = 0
  let creditsUsed = 0

  for (const catalogId of catalogIds) {
    const parts = splitCatalogId(catalogId)
    const scrydexId = parts?.scrydexId ?? null
    const entry: RepairScrydexPricesResult["results"][number] = {
      catalogId,
      scrydexId,
      raw: null,
      psa10: null,
      refreshed: false,
      cardsUpdated: false,
    }

    try {
      const refresh = await forceRefreshCatalogCard(catalogId)
      entry.refreshed = refresh.refreshed
      creditsUsed += refresh.creditsUsed
      if (refresh.refreshed) refreshed += 1

      const bundle = await loadCardBundle(catalogId)
      const priceRow =
        bundle?.card &&
        scrydexBundleToCardPriceRow({
          card: bundle.card,
          raw: (bundle.raw ?? []) as never[],
          graded: (bundle.graded ?? []) as never[],
          legacyCardId: catalogIdToLegacyPokeId(catalogId) ?? undefined,
        })

      entry.raw = priceRow?.raw_price ?? null
      entry.psa10 = priceRow?.psa10_price ?? null

      if (scrydexId && (entry.raw != null || entry.psa10 != null)) {
        const rowsWritten = await upsertWebhookDailyHistory({
          scrydexId,
          game: parts?.game ?? "pokemon",
          raw: entry.raw,
          psa10: entry.psa10,
        })
        historyRows += rowsWritten
      }

      if (refresh.refreshed) {
        entry.cardsUpdated = await syncPublicCardsRowFromCatalog(catalogId)
        if (entry.cardsUpdated) cardsUpdated += 1
      }

      if (opts?.includeHistory && scrydexId) {
        const legacyId = catalogIdToLegacyPokeId(catalogId) ?? catalogId
        const history = await ensureCardDailyPriceHistory(legacyId)
        if (history.backfilled || history.distinctDays >= 2) historyBackfilled += 1
        if (history.pointsInserted > 0) creditsUsed += 3
      }
    } catch (error) {
      if (error instanceof ScrydexCreditBudgetError) {
        entry.error = error.message
        errors.push(error.message)
        results.push(entry)
        break
      }
      entry.error = error instanceof Error ? error.message : String(error)
      errors.push(`${catalogId}: ${entry.error}`)
    }

    results.push(entry)
  }

  return {
    attempted: catalogIds.length,
    refreshed,
    cardsUpdated,
    historyBackfilled,
    historyRows,
    creditsUsed,
    results,
    errors,
  }
}
