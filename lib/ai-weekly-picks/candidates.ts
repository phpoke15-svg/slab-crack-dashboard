import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { loadDailyHistoryRows } from "@/lib/scrydex/db"
import { toCatalogId } from "@/lib/scrydex/constants"
import type { AiWeeklyPickCandidate } from "@/lib/ai-weekly-picks/types"
import {
  computeMomentum30dPct,
  computeSpreadRatio,
  computeSupplyVelocity,
  priceTargetForGrade,
  recommendGradeType,
} from "@/lib/ai-weekly-picks/signals"

type PricedCardRow = {
  id: string
  name: string
  set_name: string
  image_url: string | null
  scrydex_id: string | null
  current_price_raw: number | null
  current_price_psa10: number | null
}

const MAX_CANDIDATE_SCAN = 400
const HISTORY_BATCH = 40

function pickPriceForGrade(
  grade: ReturnType<typeof recommendGradeType>,
  raw: number,
  psa10: number,
): number {
  if (grade === "PSA_10") return psa10
  return raw
}

function compositeScore(input: {
  momentum: number
  supplyVelocity: number
  spreadRatio: number
  pickPrice: number
}): number {
  const momentumNorm = Math.max(0, Math.min(1, (input.momentum + 10) / 40))
  const velocityNorm = Math.max(0, Math.min(1, input.supplyVelocity / 20))
  const spreadNorm = Math.max(0, Math.min(1, (input.spreadRatio - 1) / 1.5))
  const valueNorm = Math.max(0, 1 - input.pickPrice / 1000)
  return momentumNorm * 0.35 + spreadNorm * 0.35 + velocityNorm * 0.2 + valueNorm * 0.1
}

async function fetchPricedCardsUnder(maxPrice: number): Promise<PricedCardRow[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = createAdminClient()
  const rows: PricedCardRow[] = []

  for (let page = 0; page < 8; page++) {
    const from = page * 500
    const to = from + 499
    const { data, error } = await supabase
      .from("cards")
      .select(
        "id, name, set_name, image_url, scrydex_id, current_price_raw, current_price_psa10",
      )
      .not("scrydex_id", "is", null)
      .gt("current_price_raw", 0)
      .lt("current_price_raw", maxPrice)
      .gt("current_price_psa10", 0)
      .lt("current_price_psa10", maxPrice)
      .order("id", { ascending: true })
      .range(from, to)

    if (error?.code === "42P01" || error?.code === "42703") return []
    if (error) throw error

    const batch = (data ?? []) as PricedCardRow[]
    rows.push(...batch)
    if (batch.length < 500) break
  }

  return rows.slice(0, MAX_CANDIDATE_SCAN)
}

export async function gatherWeeklyPickCandidates(limit = 15): Promise<AiWeeklyPickCandidate[]> {
  const cards = await fetchPricedCardsUnder(1000)
  const preScored = cards
    .map((card) => {
      const scrydexId = String(card.scrydex_id ?? "").trim()
      const raw = Number(card.current_price_raw ?? 0)
      const psa10 = Number(card.current_price_psa10 ?? 0)
      if (!scrydexId || raw <= 0 || psa10 <= 0) return null

      const spreadRatio = computeSpreadRatio(raw, psa10)
      const preliminary = spreadRatio * 0.6 + (psa10 - raw) / Math.max(raw, 1)
      return { card, scrydexId, raw, psa10, spreadRatio, preliminary }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => b.preliminary - a.preliminary)
    .slice(0, HISTORY_BATCH)

  const candidates: AiWeeklyPickCandidate[] = []

  for (const entry of preScored) {
    const catalogId = toCatalogId("pokemon", entry.scrydexId)
    const history = (await loadDailyHistoryRows(catalogId, 45)) as Array<Record<string, unknown>>

    const momentumRaw = computeMomentum30dPct(history, "RAW")
    const momentumPsa10 = computeMomentum30dPct(history, "PSA_10")
    const supplyVelocity = computeSupplyVelocity(history)
    const spreadRatio = computeSpreadRatio(entry.raw, entry.psa10)
    const recommendedGrade = recommendGradeType(
      entry.raw,
      entry.psa10,
      momentumRaw,
      momentumPsa10,
      spreadRatio,
    )
    const pickPrice = pickPriceForGrade(recommendedGrade, entry.raw, entry.psa10)
    if (pickPrice <= 0 || pickPrice >= 1000) continue

    const momentum = recommendedGrade === "PSA_10" ? momentumPsa10 : momentumRaw
    const composite = compositeScore({
      momentum,
      supplyVelocity,
      spreadRatio,
      pickPrice,
    })

    candidates.push({
      scrydex_id: entry.scrydexId,
      catalog_id: catalogId,
      card_name: entry.card.name,
      set_name: entry.card.set_name,
      image_url: entry.card.image_url,
      raw_price: entry.raw,
      psa10_price: entry.psa10,
      recommended_grade: recommendedGrade,
      pick_price: pickPrice,
      momentum_30d_pct: Number(momentum.toFixed(2)),
      supply_velocity: supplyVelocity,
      spread_ratio: Number(spreadRatio.toFixed(3)),
      composite_score: Number(composite.toFixed(4)),
    })
  }

  return candidates.sort((a, b) => b.composite_score - a.composite_score).slice(0, limit)
}

export function buildFallbackRationale(candidate: AiWeeklyPickCandidate): string {
  const target = priceTargetForGrade(
    candidate.recommended_grade,
    candidate.raw_price,
    candidate.psa10_price,
    candidate.momentum_30d_pct,
  )
  return `Scrydex shows ${candidate.momentum_30d_pct.toFixed(1)}% 30-day momentum with a ${candidate.spread_ratio.toFixed(2)}× PSA 10 spread and active price updates (${candidate.supply_velocity} recent snapshots). We like ${candidate.recommended_grade} near $${candidate.pick_price.toFixed(2)} with a target around $${target.toFixed(2)}.`
}

export { priceTargetForGrade }
