import type { CatalogCardRow } from "@/lib/db/cards-catalog"
import { getCatalogFeedFromDb } from "@/lib/db/catalog-feed"
import type { CardPriceRow } from "@/lib/pricing/types"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { MOCK_GRADED_CARDS } from "@/lib/card-filters/mock-catalog"
import {
  fetchScrydexGradedPriceIndex,
  fetchScrydexPopulationIndex,
  populationReportKey,
  resolveCardCatalogId,
  resolveSlabPopCount,
} from "@/lib/card-filters/slabpop-population"
import type { CardGrade, SlabPopCard } from "@/lib/card-filters/types"
import { createReadClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { SampleCounts } from "@/lib/slab-data"

const DEFAULT_CARD_POOL = 350
const POP_HISTORY_DAYS = 30

type PsaGradeSpec = {
  grade: CardGrade
  priceKey: keyof Pick<CardPriceRow, "psa8_price" | "psa9_price" | "psa10_price">
  sampleKey: keyof SampleCounts
  historyGrade: 8 | 9 | 10
}

type ExtraGraderSpec = {
  grade: CardGrade
  company: string
  gradeKey: string
}

const PSA_GRADE_SPECS: PsaGradeSpec[] = [
  { grade: "PSA 8", priceKey: "psa8_price", sampleKey: "psa8", historyGrade: 8 },
  { grade: "PSA 9", priceKey: "psa9_price", sampleKey: "psa9", historyGrade: 9 },
  { grade: "PSA 10", priceKey: "psa10_price", sampleKey: "psa10", historyGrade: 10 },
]

const EXTRA_GRADER_SPECS: ExtraGraderSpec[] = [
  { grade: "BGS 9.5", company: "BGS", gradeKey: "9.5" },
  { grade: "BGS 10", company: "BGS", gradeKey: "10" },
  { grade: "CGC 10", company: "CGC", gradeKey: "10" },
]

function catalogMatchKey(setName: string, name: string): string {
  return `${setName.trim().toLowerCase()}|${name.trim().toLowerCase()}`
}

function formatTitle(name: string, setName: string): string {
  return `${name} · ${setName}`
}

function rowId(cardId: string, grade: CardGrade): string {
  return `${cardId}::${grade.replace(/\s+/g, "-").toLowerCase()}`
}

async function buildSampleCountIndex(): Promise<Map<string, SampleCounts>> {
  const index = new Map<string, SampleCounts>()

  try {
    const feed = await getCatalogFeedFromDb()
    for (const entry of feed) {
      if (!entry.sampleCounts) continue
      if (entry.pokemonTcgId) {
        index.set(`poke-${entry.pokemonTcgId}`, entry.sampleCounts)
        index.set(entry.pokemonTcgId, entry.sampleCounts)
      }
      index.set(catalogMatchKey(entry.setName, entry.cardName), entry.sampleCounts)
    }
  } catch (error) {
    console.warn("[slabpop-catalog] sample count index failed:", error)
  }

  return index
}

function sampleCountForCard(
  cardId: string,
  setName: string,
  name: string,
  spec: PsaGradeSpec,
  sampleIndex: Map<string, SampleCounts>,
): number | null {
  const counts =
    sampleIndex.get(cardId) ??
    sampleIndex.get(cardId.replace(/^poke-/, "")) ??
    sampleIndex.get(catalogMatchKey(setName, name))

  if (!counts) return null
  const value = counts[spec.sampleKey]
  return value > 0 ? value : null
}

async function fetchMarketActivityPop(cardIds: string[]): Promise<Map<string, number>> {
  const activity = new Map<string, number>()
  if (!isSupabaseConfigured() || cardIds.length === 0) return activity

  const since = new Date(Date.now() - POP_HISTORY_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const supabase = createReadClient()
  const chunkSize = 150

  try {
    for (let i = 0; i < cardIds.length; i += chunkSize) {
      const chunk = cardIds.slice(i, i + chunkSize)
      const { data, error } = await supabase
        .from("price_history")
        .select("card_id, grade, sale_count")
        .in("card_id", chunk)
        .gte("snapshot_date", since)
        .gt("grade", 0)

      if (error) {
        if (error.code === "42P01") return activity
        throw error
      }

      for (const row of data ?? []) {
        const cardId = String(row.card_id)
        const grade = Number(row.grade)
        const count = row.sale_count == null ? 1 : Number(row.sale_count)
        if (!Number.isFinite(count) || count <= 0) continue
        const key = `${cardId}::${grade}`
        activity.set(key, (activity.get(key) ?? 0) + count)
      }
    }
  } catch (error) {
    console.warn("[slabpop-catalog] price_history activity failed:", error)
  }

  return activity
}

function buildSlabPopCard(input: {
  cardId: string
  catalogId: string | null
  title: string
  setName: string
  cardNumber?: string
  image: string
  grade: CardGrade
  price: number
  popCount: number
  popSource: NonNullable<SlabPopCard["popSource"]>
}): SlabPopCard {
  return {
    id: rowId(input.cardId, input.grade),
    cardId: input.cardId,
    catalogId: input.catalogId,
    title: input.title,
    price: input.price,
    popCount: input.popCount,
    grade: input.grade,
    image: input.image,
    setName: input.setName,
    cardNumber: input.cardNumber,
    popSource: input.popSource,
  }
}

function expandPsaRows(
  priceRow: CardPriceRow,
  card: CatalogCardRow,
  catalogId: string | null,
  sampleIndex: Map<string, SampleCounts>,
  marketActivity: Map<string, number>,
  scrydexPop: Map<string, number>,
): SlabPopCard[] {
  const rows: SlabPopCard[] = []
  const image = upgradeCardImageUrlSync(card.image_url ?? "/placeholder.svg")
  const titleBase = card.name
  const setName = card.set_name

  for (const spec of PSA_GRADE_SPECS) {
    const price = priceRow[spec.priceKey]
    if (price == null || price <= 0) continue

    const registryPop =
      catalogId != null
        ? scrydexPop.get(populationReportKey(catalogId, "PSA", String(spec.historyGrade))) ?? null
        : null
    const soldCompPop = sampleCountForCard(priceRow.card_id, setName, titleBase, spec, sampleIndex)
    const activityKey = `${priceRow.card_id}::${spec.historyGrade}`
    const marketPop = marketActivity.get(activityKey) ?? 0
    const resolved = resolveSlabPopCount({
      scrydexPop: registryPop,
      soldCompPop,
      marketActivityPop: marketPop,
    })
    if (!resolved) continue

    rows.push(
      buildSlabPopCard({
        cardId: priceRow.card_id,
        catalogId,
        title: formatTitle(titleBase, setName),
        setName,
        cardNumber: card.number || undefined,
        image,
        grade: spec.grade,
        price: Math.round(price * 100) / 100,
        popCount: resolved.popCount,
        popSource: resolved.popSource,
      }),
    )
  }

  return rows
}

function expandAlternateGraderRows(
  cardId: string,
  catalogId: string | null,
  card: CatalogCardRow,
  scrydexPop: Map<string, number>,
  scrydexGradedPrices: Map<string, number>,
): SlabPopCard[] {
  if (!catalogId) return []

  const rows: SlabPopCard[] = []
  const image = upgradeCardImageUrlSync(card.image_url ?? "/placeholder.svg")
  const setName = card.set_name

  for (const spec of EXTRA_GRADER_SPECS) {
    const key = populationReportKey(catalogId, spec.company, spec.gradeKey)
    const price = scrydexGradedPrices.get(key)
    if (price == null || price <= 0) continue

    const resolved = resolveSlabPopCount({
      scrydexPop: scrydexPop.get(key) ?? null,
      soldCompPop: null,
      marketActivityPop: 0,
    })
    if (!resolved) continue

    rows.push(
      buildSlabPopCard({
        cardId,
        catalogId,
        title: formatTitle(card.name, setName),
        setName,
        cardNumber: card.number || undefined,
        image,
        grade: spec.grade,
        price,
        popCount: resolved.popCount,
        popSource: resolved.popSource,
      }),
    )
  }

  return rows
}

async function fetchGradedPricePool(limit: number): Promise<CardPriceRow[]> {
  const supabase = createReadClient()
  const { data, error } = await supabase
    .from("card_prices")
    .select(
      "card_id, raw_price, psa8_price, psa9_price, psa10_price, price_source, synced_at, sync_error, card_name, card_set, card_number",
    )
    .like("card_id", "poke-%")
    .neq("sync_error", "unavailable")
    .or("psa8_price.gt.0,psa9_price.gt.0,psa10_price.gt.0")
    .order("psa10_price", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    if (error.code === "42P01") return []
    throw error
  }

  return (data ?? []).map((row) => ({
    card_id: String(row.card_id),
    raw_price: row.raw_price == null ? null : Number(row.raw_price),
    psa7_price: null,
    psa8_price: row.psa8_price == null ? null : Number(row.psa8_price),
    psa9_price: row.psa9_price == null ? null : Number(row.psa9_price),
    psa10_price: row.psa10_price == null ? null : Number(row.psa10_price),
    price_source: String(row.price_source ?? "pricecharting"),
    synced_at: String(row.synced_at),
    sync_error: row.sync_error == null ? null : String(row.sync_error),
    card_name: row.card_name == null ? null : String(row.card_name),
    card_set: row.card_set == null ? null : String(row.card_set),
    card_number: row.card_number == null ? null : String(row.card_number),
  }))
}

async function fetchCatalogCards(cardIds: string[]): Promise<Map<string, CatalogCardRow>> {
  const byId = new Map<string, CatalogCardRow>()
  if (!isSupabaseConfigured() || cardIds.length === 0) return byId

  const supabase = createReadClient()
  const chunkSize = 200

  for (let i = 0; i < cardIds.length; i += chunkSize) {
    const chunk = cardIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from("cards")
      .select(
        "id, name, japanese_name, set_name, set_id, number, rarity, image_url, language, updated_at, scrydex_id",
      )
      .in("id", chunk)

    if (error) {
      if (error.code === "42P01") return byId
      throw error
    }

    for (const row of (data ?? []) as CatalogCardRow[]) {
      byId.set(row.id, row)
    }
  }

  return byId
}

function mockFallbackCatalog(): SlabPopCard[] {
  return MOCK_GRADED_CARDS.map((card) => ({
    ...card,
    cardId: card.cardId ?? card.id,
    image: card.image ?? "/placeholder.svg",
    popSource: "demo" as const,
  }))
}

/**
 * Live SlabPop catalog: PSA graded prices from card_prices + Scrydex population reports.
 * Pop counts prefer PSA registry population, then SlabCrack sold comps, then price_history activity.
 */
export async function getSlabPopCatalog(limit = DEFAULT_CARD_POOL): Promise<SlabPopCard[]> {
  if (!isSupabaseConfigured()) return mockFallbackCatalog()

  try {
    const [priceRows, sampleIndex] = await Promise.all([
      fetchGradedPricePool(limit),
      buildSampleCountIndex(),
    ])

    if (!priceRows.length) return mockFallbackCatalog()

    const cardIds = [...new Set(priceRows.map((row) => row.card_id))]
    const [cardsById, marketActivity] = await Promise.all([
      fetchCatalogCards(cardIds),
      fetchMarketActivityPop(cardIds),
    ])

    const catalogIds = [
      ...new Set(
        cardIds
          .map((cardId) => resolveCardCatalogId(cardId, cardsById.get(cardId)?.scrydex_id))
          .filter((catalogId): catalogId is string => Boolean(catalogId)),
      ),
    ]

    const [scrydexPop, scrydexGradedPrices] = await Promise.all([
      fetchScrydexPopulationIndex(catalogIds),
      fetchScrydexGradedPriceIndex(catalogIds),
    ])

    const catalog: SlabPopCard[] = []
    for (const priceRow of priceRows) {
      const card = cardsById.get(priceRow.card_id)
      if (!card) continue

      const catalogId = resolveCardCatalogId(priceRow.card_id, card.scrydex_id)
      catalog.push(
        ...expandPsaRows(priceRow, card, catalogId, sampleIndex, marketActivity, scrydexPop),
        ...expandAlternateGraderRows(
          priceRow.card_id,
          catalogId,
          card,
          scrydexPop,
          scrydexGradedPrices,
        ),
      )
    }

    if (!catalog.length) return mockFallbackCatalog()

    catalog.sort((a, b) => b.price - a.price)
    return catalog
  } catch (error) {
    console.error("[slabpop-catalog] live catalog failed:", error)
    return mockFallbackCatalog()
  }
}

export { DEFAULT_CARD_POOL }
