import "server-only"
import {
  catalogToSearchHit,
  searchHitToPlaceholder,
  type CardSearchHit,
} from "@/lib/card-lookup"
import {
  cleanNumber,
  minAutoMatchScore,
  scoreHit,
  simplifyCardName,
  type DetectedCard,
} from "@/lib/slabcrack/identify-parse"
import {
  buildGradeQuotes,
  normalizeCardEntry,
  type MockCardEntry,
  type PsaGradeNumber,
} from "@/lib/slab-data"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"

type SlabCardRow = {
  id: string
  name: string
  set_name: string
  card_number: string
  rarity: string | null
  image_large: string | null
  image_small: string | null
}

type AnomalyPriceRow = {
  watchlist_id: string
  card_id: string | null
  raw_price: number
  slab_grade: number
  slab_price: number
  deficit: number
  percentage_savings: number
  grade_prices: Record<string, { slab_price: number }> | null
  market_insight?: string | null
}

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&")
}

function formatCardName(name: string, rarity: string | null): string {
  if (!rarity) return name
  if (name.toLowerCase().includes(rarity.toLowerCase())) return name
  return `${name} (${rarity})`
}

function rowToHit(row: SlabCardRow): CardSearchHit {
  return catalogToSearchHit({
    id: row.id,
    name: row.name,
    setName: row.set_name,
    cardNumber: row.card_number,
    rarity: row.rarity,
    imageSmall: row.image_small,
    imageLarge: row.image_large,
  })
}

function anomalyToEntry(row: AnomalyPriceRow, hit: CardSearchHit): MockCardEntry {
  const rawPrice = Number(row.raw_price) || 0
  const byGrade: Partial<Record<PsaGradeNumber, { slabPrice: number }>> = {}

  if (row.grade_prices && Object.keys(row.grade_prices).length > 0) {
    for (const [gradeKey, value] of Object.entries(row.grade_prices)) {
      const grade = Number(gradeKey) as PsaGradeNumber
      if (grade !== 7 && grade !== 8 && grade !== 9 && grade !== 10) continue
      const slabPrice = Number(value.slab_price)
      if (slabPrice > 0) byGrade[grade] = { slabPrice }
    }
  } else if (row.slab_grade && row.slab_price > 0) {
    byGrade[row.slab_grade as PsaGradeNumber] = { slabPrice: Number(row.slab_price) }
  }

  const gradeQuotes = buildGradeQuotes(rawPrice, byGrade)
  return normalizeCardEntry({
    id: row.watchlist_id || hit.id,
    pokemonTcgId: hit.pokemonTcgId,
    cardName: formatCardName(hit.cardName, hit.rarity),
    setName: hit.setName,
    cardNumber: hit.cardNumber,
    imageUrl: hit.imageUrl || "https://placehold.co/150x210",
    rawPrice,
    slabGrade: row.slab_grade || 8,
    slabPrice: Number(row.slab_price) || 0,
    deficit: Number(row.deficit) || 0,
    percentageSavings: Number(row.percentage_savings) || 0,
    marketInsight: row.market_insight || "Local catalog match — live PriceCharting refresh optional.",
    hasPricing: rawPrice > 0 || gradeQuotes.some((q) => q.slabPrice > 0),
    gradeQuotes,
  })
}

async function searchSlabCardsLocal(detected: DetectedCard): Promise<CardSearchHit[]> {
  if (!isSupabaseConfigured()) return []

  const supabase = createAdminClient()
  const simpleName = simplifyCardName(detected.cardName)
  const firstName =
    simpleName
      .split(/\s+/)
      .find((t) => t.length > 2 && !/^(ex|gx|v|vmax|vstar)$/i.test(t)) ?? simpleName
  const number = cleanNumber(detected.cardNumber)
  const setName = detected.setName.trim()

  if (!firstName && !number) return []

  // Prefer name search (fast enough on catalog size); number is ranked in JS so
  // padded DB values like "025/198" still match cleaned "25".
  let query = supabase
    .from("slab_cards")
    .select("id, name, set_name, card_number, rarity, image_large, image_small")
    .limit(64)

  if (firstName) {
    query = query.ilike("name", `%${escapeIlike(firstName)}%`)
  } else if (number) {
    query = query.or(
      `card_number.eq.${number},card_number.ilike.${number}/%,card_number.ilike.%/${number}`,
    )
  }

  const { data, error } = await query
  if (error) {
    console.warn("[slabcrack-local] slab_cards query failed:", error.message)
    return []
  }

  const rows = (data ?? []) as SlabCardRow[]
  if (!rows.length) return []

  const ranked = rows
    .map((row) => {
      const hit = rowToHit(row)
      let score = scoreHit(hit, detected)
      if (setName && row.set_name.toLowerCase().includes(setName.toLowerCase().slice(0, 12))) {
        score += 5
      }
      return { hit, score }
    })
    .sort((a, b) => b.score - a.score)

  return ranked.slice(0, 8).map((entry) => entry.hit)
}

async function priceHitLocal(hit: CardSearchHit): Promise<MockCardEntry> {
  if (!isSupabaseConfigured()) {
    return searchHitToPlaceholder(hit)
  }

  const supabase = createAdminClient()
  const candidateIds = Array.from(
    new Set(
      [hit.pokemonTcgId, hit.id.replace(/^poke-/, ""), hit.id].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  )

  // Prefer anomaly row (has PSA grades) when this card is on the watchlist feed.
  for (const cardId of candidateIds) {
    const anomaly = await supabase
      .from("slab_anomalies")
      .select(
        `
      watchlist_id,
      card_id,
      raw_price,
      slab_grade,
      slab_price,
      deficit,
      percentage_savings,
      grade_prices,
      slab_watchlist_cards ( market_insight )
    `,
      )
      .eq("card_id", cardId)
      .limit(1)
      .maybeSingle()

    if (!anomaly.error && anomaly.data) {
      const row = anomaly.data as AnomalyPriceRow & {
        slab_watchlist_cards?: { market_insight?: string | null } | null
      }
      return anomalyToEntry(
        {
          ...row,
          market_insight: row.slab_watchlist_cards?.market_insight ?? null,
        },
        hit,
      )
    }
  }

  // Binder/raw cache — instant raw NM without live PriceCharting.
  for (const cardId of candidateIds) {
    const binder = await supabase
      .from("binder_card_prices")
      .select("raw_price")
      .eq("card_id", cardId)
      .gt("raw_price", 0)
      .limit(1)
      .maybeSingle()

    const rawPrice = !binder.error && binder.data ? Number(binder.data.raw_price) : 0
    if (rawPrice > 0) {
      return normalizeCardEntry({
        ...searchHitToPlaceholder(hit),
        cardName: formatCardName(hit.cardName, hit.rarity),
        rawPrice,
        hasPricing: true,
        marketInsight: "Local raw price — slab comps refresh in background when available.",
        gradeQuotes: buildGradeQuotes(rawPrice, {}),
      })
    }
  }

  return {
    ...searchHitToPlaceholder(hit),
    cardName: formatCardName(hit.cardName, hit.rarity),
    marketInsight: "Local catalog match — loading live slab comps…",
  }
}

export type LocalMatchResult = {
  candidates: CardSearchHit[]
  hit: CardSearchHit | null
  card: MockCardEntry | null
  matchScore: number
  /** True when we should still try live PriceCharting for fuller PSA comps. */
  needsLiveRefresh: boolean
}

/**
 * Fast local match against Supabase slab_cards + cached prices.
 * Returns null when Supabase is unavailable or no decent local hit exists.
 */
export async function matchDetectedCardLocal(
  detected: DetectedCard,
): Promise<LocalMatchResult | null> {
  const started = Date.now()
  try {
    const candidates = await searchSlabCardsLocal(detected)
    if (!candidates.length) return null

    const ranked = [...candidates].sort(
      (a, b) => scoreHit(b, detected) - scoreHit(a, detected),
    )
    const top = ranked[0]!
    const matchScore = scoreHit(top, detected)
    if (matchScore < Math.min(20, minAutoMatchScore(detected))) {
      return null
    }

    const card = await priceHitLocal(top)
    const needsLiveRefresh =
      card.hasPricing === false ||
      !card.gradeQuotes?.some((q) => q.grade >= 7 && q.slabPrice > 0)

    console.warn(
      `[slabcrack-local] hit score=${matchScore} priced=${card.hasPricing !== false} refresh=${needsLiveRefresh} in ${Date.now() - started}ms`,
    )

    return {
      candidates: ranked,
      hit: top,
      card: normalizeCardEntry(card),
      matchScore,
      needsLiveRefresh,
    }
  } catch (error) {
    console.warn(
      "[slabcrack-local] failed:",
      error instanceof Error ? error.message : error,
    )
    return null
  }
}
