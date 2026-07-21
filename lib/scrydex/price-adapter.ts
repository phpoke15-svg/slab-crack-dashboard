import type { CardPriceRow } from "@/lib/pricing/types"
import { catalogIdToLegacyPokeId, resolveCatalogId } from "@/lib/scrydex/constants"
import type { CatalogCardRow } from "@/lib/scrydex/types"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { expandCardIdList } from "@/lib/trade-binder/card-id-match"

type RawPriceRow = {
  catalog_id: string
  variant?: string
  condition?: string
  market_price?: number | null
  synced_at?: string
}

type GradedPriceRow = {
  catalog_id: string
  variant?: string
  company?: string
  grade?: string
  market_price?: number | null
  synced_at?: string
}

function pickBestRaw(raw: RawPriceRow[]): { price: number; syncedAt: string } | null {
  const preferred = raw.find(
    (row) => (row.variant ?? "normal") === "normal" && (row.condition ?? "NM") === "NM",
  )
  const row = preferred ?? raw.find((entry) => (entry.market_price ?? 0) > 0)
  if (!row || (row.market_price ?? 0) <= 0) return null
  return {
    price: Number(row.market_price),
    syncedAt: String(row.synced_at ?? new Date().toISOString()),
  }
}

function pickPsaGrade(graded: GradedPriceRow[], grade: string): number | null {
  const row = graded.find(
    (entry) =>
      (entry.company ?? "").toUpperCase() === "PSA" &&
      String(entry.grade) === grade &&
      (entry.variant ?? "normal") === "normal",
  )
  const price = row?.market_price
  return price != null && price > 0 ? Number(price) : null
}

function latestSyncedAt(raw: RawPriceRow[], graded: GradedPriceRow[]): string {
  const timestamps = [
    ...raw.map((row) => row.synced_at),
    ...graded.map((row) => row.synced_at),
  ].filter(Boolean) as string[]
  if (timestamps.length === 0) return new Date().toISOString()
  return timestamps.sort().at(-1)!
}

export function scrydexBundleToCardPriceRow(input: {
  card: Pick<CatalogCardRow, "catalog_id" | "name" | "set_name" | "number">
  raw: RawPriceRow[]
  graded: GradedPriceRow[]
  legacyCardId?: string
}): CardPriceRow | null {
  const best = pickBestRaw(input.raw)
  const psa7 = pickPsaGrade(input.graded, "7")
  const psa8 = pickPsaGrade(input.graded, "8")
  const psa9 = pickPsaGrade(input.graded, "9")
  const psa10 = pickPsaGrade(input.graded, "10")

  const hasAny =
    (best?.price ?? 0) > 0 || psa7 != null || psa8 != null || psa9 != null || psa10 != null
  if (!hasAny) return null

  const cardId = input.legacyCardId ?? catalogIdToLegacyPokeId(input.card.catalog_id) ?? input.card.catalog_id

  return {
    card_id: cardId,
    raw_price: best?.price ?? null,
    psa7_price: psa7,
    psa8_price: psa8,
    psa9_price: psa9,
    psa10_price: psa10,
    price_source: "scrydex",
    synced_at: best?.syncedAt ?? latestSyncedAt(input.raw, input.graded),
    sync_error: null,
    card_name: input.card.name ?? null,
    card_set: input.card.set_name ?? null,
    card_number: input.card.number ?? null,
  }
}

/** Read NM raw prices from the Scrydex cache for legacy card ids (poke-* / bare tcg ids). */
export async function getScrydexRawPricesForIds(cardIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (!isSupabaseConfigured() || cardIds.length === 0) return result

  const catalogByRequestedId = new Map<string, string>()
  for (const id of cardIds) {
    const catalogId = resolveCatalogId(id)
    if (catalogId) catalogByRequestedId.set(id, catalogId)
  }

  const catalogIds = [...new Set(catalogByRequestedId.values())]
  if (catalogIds.length === 0) return result

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("prices_raw")
      .select("catalog_id, variant, condition, market_price")
      .in("catalog_id", catalogIds)

    if (error?.code === "42P01") return result
    if (error) throw error

    const priceByCatalogId = new Map<string, number>()
    for (const catalogId of catalogIds) {
      const rows = ((data ?? []) as RawPriceRow[]).filter((row) => row.catalog_id === catalogId)
      const best = pickBestRaw(rows)
      if (best) priceByCatalogId.set(catalogId, best.price)
    }

    for (const id of cardIds) {
      const catalogId = catalogByRequestedId.get(id)
      if (!catalogId) continue
      const price = priceByCatalogId.get(catalogId)
      if (price && price > 0) result.set(id, price)
    }

    for (const id of expandCardIdList(cardIds)) {
      if (result.has(id)) continue
      const catalogId = catalogByRequestedId.get(id) ?? resolveCatalogId(id)
      if (!catalogId) continue
      const price = priceByCatalogId.get(catalogId)
      if (price && price > 0) result.set(id, price)
    }
  } catch (error) {
    console.error("[scrydex/price-adapter] raw price lookup failed:", error)
  }

  return result
}

export async function getScrydexCardPriceRowsForIds(cardIds: string[]): Promise<Map<string, CardPriceRow>> {
  const rows = new Map<string, CardPriceRow>()
  if (!isSupabaseConfigured() || cardIds.length === 0) return rows

  const catalogByRequestedId = new Map<string, string>()
  for (const id of cardIds) {
    const catalogId = resolveCatalogId(id)
    if (catalogId) catalogByRequestedId.set(id, catalogId)
  }

  const catalogIds = [...new Set(catalogByRequestedId.values())]
  if (catalogIds.length === 0) return rows

  try {
    const supabase = createAdminClient()
    const [cardsRes, rawRes, gradedRes] = await Promise.all([
      supabase
        .from("catalog_cards")
        .select("catalog_id, name, set_name, number")
        .in("catalog_id", catalogIds),
      supabase.from("prices_raw").select("*").in("catalog_id", catalogIds),
      supabase.from("prices_graded").select("*").in("catalog_id", catalogIds),
    ])

    if (cardsRes.error?.code === "42P01") return rows
    if (cardsRes.error) throw cardsRes.error
    if (rawRes.error?.code !== "42P01" && rawRes.error) throw rawRes.error
    if (gradedRes.error?.code !== "42P01" && gradedRes.error) throw gradedRes.error

    const rawByCatalog = new Map<string, RawPriceRow[]>()
    for (const row of (rawRes.data ?? []) as RawPriceRow[]) {
      const list = rawByCatalog.get(row.catalog_id) ?? []
      list.push(row)
      rawByCatalog.set(row.catalog_id, list)
    }

    const gradedByCatalog = new Map<string, GradedPriceRow[]>()
    for (const row of (gradedRes.data ?? []) as GradedPriceRow[]) {
      const list = gradedByCatalog.get(row.catalog_id) ?? []
      list.push(row)
      gradedByCatalog.set(row.catalog_id, list)
    }

    for (const card of (cardsRes.data ?? []) as Array<
      Pick<CatalogCardRow, "catalog_id" | "name" | "set_name" | "number">
    >) {
      const priceRow = scrydexBundleToCardPriceRow({
        card,
        raw: rawByCatalog.get(card.catalog_id) ?? [],
        graded: gradedByCatalog.get(card.catalog_id) ?? [],
      })
      if (!priceRow) continue

      for (const [requestedId, catalogId] of catalogByRequestedId) {
        if (catalogId !== card.catalog_id) continue
        rows.set(requestedId, { ...priceRow, card_id: requestedId })
      }
    }
  } catch (error) {
    console.error("[scrydex/price-adapter] card price rows failed:", error)
  }

  return rows
}
