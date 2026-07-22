import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { toCatalogId } from "@/lib/scrydex/constants"
import { loadDailyHistoryRows } from "@/lib/scrydex/db"
import { priceTargetForGrade } from "@/lib/ai-weekly-picks/candidates"
import { loadAllWeeklyPicks } from "@/lib/ai-weekly-picks/db"
import { computeMomentum30dPct, priceFromHistoryRows } from "@/lib/ai-weekly-picks/signals"
import type {
  AiPortfolioPerformancePoint,
  AiPortfolioPerformanceSummary,
  AiWeeklyPickDisplay,
  AiWeeklyPickRow,
  AiWeeklyGradeType,
} from "@/lib/ai-weekly-picks/types"

type CardPriceRow = {
  scrydex_id: string | null
  name: string
  set_name: string
  image_url: string | null
  current_price_raw: number | null
  current_price_psa10: number | null
}

function currentPriceForGrade(row: CardPriceRow, grade: AiWeeklyGradeType): number | null {
  if (grade === "PSA_10") {
    const price = Number(row.current_price_psa10 ?? 0)
    return price > 0 ? price : null
  }
  const raw = Number(row.current_price_raw ?? 0)
  return raw > 0 ? raw : null
}

async function loadCardMetaByScrydexIds(ids: string[]): Promise<Map<string, CardPriceRow>> {
  const map = new Map<string, CardPriceRow>()
  if (!isSupabaseConfigured() || ids.length === 0) return map

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("cards")
    .select("scrydex_id, name, set_name, image_url, current_price_raw, current_price_psa10")
    .in("scrydex_id", ids)

  if (error?.code === "42P01" || error?.code === "42703") return map
  if (error) throw error

  for (const row of (data ?? []) as CardPriceRow[]) {
    const id = String(row.scrydex_id ?? "").trim()
    if (id) map.set(id, row)
  }
  return map
}

function groupByWeek(rows: AiWeeklyPickRow[]): Map<string, AiWeeklyPickRow[]> {
  const grouped = new Map<string, AiWeeklyPickRow[]>()
  for (const row of rows) {
    const week = String(row.week_start_date)
    const list = grouped.get(week) ?? []
    list.push(row)
    grouped.set(week, list)
  }
  return grouped
}

export async function enrichWeeklyPicksForDisplay(
  picks: AiWeeklyPickRow[],
): Promise<AiWeeklyPickDisplay[]> {
  const meta = await loadCardMetaByScrydexIds([...new Set(picks.map((pick) => pick.scrydex_id))])

  return picks.map((pick) => {
    const card = meta.get(pick.scrydex_id)
    const current = card ? currentPriceForGrade(card, pick.grade_type) : null
    const returnPct =
      current != null && pick.pick_price > 0
        ? Number((((current - pick.pick_price) / pick.pick_price) * 100).toFixed(2))
        : null

    const raw = Number(card?.current_price_raw ?? 0)
    const psa10 = Number(card?.current_price_psa10 ?? 0)
    const momentum = returnPct ?? 0

    return {
      ...pick,
      confidence_score: Number(pick.confidence_score),
      pick_price: Number(pick.pick_price),
      card_name: card?.name ?? pick.scrydex_id,
      set_name: card?.set_name ?? "Unknown set",
      image_url: card?.image_url ?? null,
      current_price: current,
      price_target: priceTargetForGrade(pick.grade_type, raw, psa10, momentum),
      return_pct: returnPct,
    }
  })
}

export async function computePortfolioPerformance(
  limitWeeks = 12,
): Promise<AiPortfolioPerformanceSummary> {
  const allPicks = await loadAllWeeklyPicks(limitWeeks)
  const grouped = groupByWeek(allPicks)
  const weeks = [...grouped.keys()].sort()

  let wins = 0
  let evaluated = 0
  let totalReturn = 0
  let aiCumulative = 0
  let marketCumulative = 0
  const chart: AiPortfolioPerformancePoint[] = []

  for (const week of weeks) {
    const picks = grouped.get(week) ?? []
    const enriched = await enrichWeeklyPicksForDisplay(picks)
    const weekReturns: number[] = []
    const marketReturns: number[] = []

    for (const pick of enriched) {
      if (pick.return_pct == null) continue
      weekReturns.push(pick.return_pct)
      evaluated += 1
      totalReturn += pick.return_pct
      if (pick.return_pct > 0) wins += 1

      const catalogId = toCatalogId("pokemon", pick.scrydex_id)
      const history = await loadDailyHistoryRows(catalogId, 45)
      const marketMomentum = computeMomentum30dPct(history, "RAW")
      marketReturns.push(marketMomentum)
    }

    if (weekReturns.length === 0) continue

    const aiWeek = weekReturns.reduce((sum, value) => sum + value, 0) / weekReturns.length
    const marketWeek =
      marketReturns.length > 0
        ? marketReturns.reduce((sum, value) => sum + value, 0) / marketReturns.length
        : aiWeek * 0.6

    aiCumulative += aiWeek
    marketCumulative += marketWeek
    chart.push({
      week_start_date: week,
      ai_cumulative_pct: Number(aiCumulative.toFixed(2)),
      market_cumulative_pct: Number(marketCumulative.toFixed(2)),
    })
  }

  return {
    total_roi_pct: evaluated > 0 ? Number((totalReturn / evaluated).toFixed(2)) : 0,
    win_rate_pct: evaluated > 0 ? Number(((wins / evaluated) * 100).toFixed(2)) : 0,
    pick_count: evaluated,
    weeks_tracked: chart.length,
    chart,
  }
}

export async function resolvePickReturnSinceWeek(
  pick: AiWeeklyPickRow,
): Promise<number | null> {
  const catalogId = toCatalogId("pokemon", pick.scrydex_id)
  const history = await loadDailyHistoryRows(catalogId, 0)
  const startPrice =
    priceFromHistoryRows(history, pick.grade_type, pick.week_start_date) ?? Number(pick.pick_price)
  const latestPrice = priceFromHistoryRows(history, pick.grade_type)
  if (!latestPrice || startPrice <= 0) return null
  return Number((((latestPrice - startPrice) / startPrice) * 100).toFixed(2))
}
