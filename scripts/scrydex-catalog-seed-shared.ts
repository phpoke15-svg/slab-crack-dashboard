import type { SupabaseClient } from "@supabase/supabase-js"
import { legacyPokeIdToCatalogId } from "@/lib/scrydex/constants"

export const POKE_CARD_SELECT =
  "id, name, set_name, set_id, number, rarity, image_url, language"

export const READ_PAGE_SIZE = 1000
export const UPSERT_CHUNK_SIZE = 100

export type LegacyCardRow = {
  id: string
  name: string
  set_name: string
  set_id: string
  number: string
  rarity: string | null
  image_url: string | null
  language: string
}

export type CatalogSeedRow = NonNullable<ReturnType<typeof cardToCatalogRow>>

export function parseOptionalLimit(argv: string[]): number | null {
  const limitArg = argv.find((arg) => arg.startsWith("--limit="))
  const limitFlagIdx = argv.indexOf("--limit")
  const limitRaw =
    limitArg?.split("=")[1] ?? (limitFlagIdx >= 0 ? argv[limitFlagIdx + 1] : undefined)

  if (limitRaw == null || limitRaw === "") return null
  const parsed = Number(limitRaw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --limit value: ${limitRaw}`)
  }
  return Math.floor(parsed)
}

export function cardToCatalogRow(row: LegacyCardRow) {
  const catalogId = legacyPokeIdToCatalogId(row.id)
  if (!catalogId) return null

  const scrydexId = catalogId.slice("pokemon-".length)
  return {
    catalog_id: catalogId,
    game: "pokemon" as const,
    scrydex_id: scrydexId,
    name: row.name,
    set_code: row.set_id || scrydexId.split("-")[0] || "unknown",
    set_name: row.set_name,
    number: row.number ?? "",
    rarity: row.rarity,
    language_code: row.language === "ja" ? "JA" : "EN",
    image_small_url: row.image_url,
    image_large_url: row.image_url,
    variants: ["normal"],
    metadata: { seeded_from: "public.cards", legacy_id: row.id },
    catalog_synced_at: new Date().toISOString(),
  }
}

export function toLegacyMapRows(catalogRows: CatalogSeedRow[]) {
  return catalogRows.map((row) => ({
    legacy_id: String(row.metadata.legacy_id),
    catalog_id: row.catalog_id,
    legacy_source: "poke-tcggo",
  }))
}

export async function countPokeCards(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .like("id", "poke-%")

  if (error) throw error
  return count ?? 0
}

/** Paginate all poke-* rows from public.cards (stable id order). */
export async function* iteratePokeCardPages(
  supabase: SupabaseClient,
  maxRows: number | null,
): AsyncGenerator<LegacyCardRow[]> {
  let offset = 0
  let yielded = 0

  while (true) {
    const remaining = maxRows == null ? READ_PAGE_SIZE : maxRows - yielded
    if (remaining <= 0) break

    const pageSize = Math.min(READ_PAGE_SIZE, remaining)
    const { data, error } = await supabase
      .from("cards")
      .select(POKE_CARD_SELECT)
      .like("id", "poke-%")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    if (!data?.length) break

    const page = data as LegacyCardRow[]
    yield page

    yielded += page.length
    offset += page.length

    if (page.length < pageSize) break
  }
}

export async function upsertCatalogRows(
  supabase: SupabaseClient,
  catalogRows: CatalogSeedRow[],
  label: string,
): Promise<number> {
  if (catalogRows.length === 0) return 0

  for (let i = 0; i < catalogRows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = catalogRows.slice(i, i + UPSERT_CHUNK_SIZE)
    const { error } = await supabase.from("catalog_cards").upsert(chunk)
    if (error?.code === "42P01") {
      console.error(`[${label}] catalog_cards table missing — run supabase/scrydex-multi-tcg.sql first`)
      process.exit(1)
    }
    if (error) throw error
  }

  return catalogRows.length
}

export async function upsertLegacyMapRows(
  supabase: SupabaseClient,
  legacyRows: ReturnType<typeof toLegacyMapRows>,
  label: string,
): Promise<number> {
  if (legacyRows.length === 0) return 0

  for (let i = 0; i < legacyRows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = legacyRows.slice(i, i + UPSERT_CHUNK_SIZE)
    const { error } = await supabase.from("catalog_id_legacy_map").upsert(chunk)
    if (error?.code === "42P01") {
      console.error(`[${label}] catalog_id_legacy_map table missing — run supabase/scrydex-multi-tcg.sql first`)
      process.exit(1)
    }
    if (error) throw error
  }

  return legacyRows.length
}

export async function copyTcggoPricesForLegacyIds(
  supabase: SupabaseClient,
  legacyIds: string[],
): Promise<number> {
  if (legacyIds.length === 0) return 0

  const catalogIds = legacyIds
    .map((id) => legacyPokeIdToCatalogId(id))
    .filter((id): id is string => Boolean(id))

  if (catalogIds.length === 0) return 0

  const { data: existingPrices, error: existingError } = await supabase
    .from("prices_raw")
    .select("catalog_id")
    .in("catalog_id", catalogIds)

  if (existingError?.code === "42P01") return 0
  if (existingError) throw existingError

  const pricedCatalogIds = new Set((existingPrices ?? []).map((row) => String(row.catalog_id)))
  const unresolvedLegacyIds = legacyIds.filter((legacyId) => {
    const catalogId = legacyPokeIdToCatalogId(legacyId)
    return catalogId != null && !pricedCatalogIds.has(catalogId)
  })

  if (unresolvedLegacyIds.length === 0) return 0

  const { data: cardPrices, error: priceError } = await supabase
    .from("card_prices")
    .select("card_id, raw_price, synced_at")
    .in("card_id", unresolvedLegacyIds)
    .gt("raw_price", 0)

  if (priceError) throw priceError

  const priceRows = ((cardPrices ?? []) as Array<{ card_id: string; raw_price: number; synced_at: string }>)
    .map((row) => {
      const catalogId = legacyPokeIdToCatalogId(row.card_id)
      if (!catalogId) return null
      return {
        catalog_id: catalogId,
        variant: "normal",
        condition: "NM",
        currency: "USD",
        market_price: row.raw_price,
        source: "tcggo-bridge",
        synced_at: row.synced_at ?? new Date().toISOString(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  for (let i = 0; i < priceRows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = priceRows.slice(i, i + UPSERT_CHUNK_SIZE)
    const { error } = await supabase.from("prices_raw").upsert(chunk)
    if (error) throw error
  }

  return priceRows.length
}
