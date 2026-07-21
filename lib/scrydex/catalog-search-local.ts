import type { SupabaseClient } from "@supabase/supabase-js"
import {
  catalogRowMatchesQuery,
  catalogSearchMinLength,
  sanitizeCatalogSearchToken,
} from "@/lib/db/catalog-search-local"
import type { CatalogCardRow } from "@/lib/db/cards-catalog"
import {
  cardNumberMatches,
  parseBinderSearchTokens,
  resolveBinderSetIdHint,
} from "@/lib/trade-binder/pokemon-tcg"
import { catalogRowMatchesSetHint } from "@/lib/db/catalog-set-match"
import { simplifyCardName } from "@/lib/slabcrack/identify-parse"
import type { CatalogCardRow as ScrydexCatalogCardRow } from "@/lib/scrydex/types"

const CARD_SELECT =
  "catalog_id, game, scrydex_id, name, set_code, set_name, number, rarity, image_small_url, image_large_url, language_code, catalog_synced_at"

function scrydexRowToLegacyRow(row: ScrydexCatalogCardRow): CatalogCardRow {
  return {
    id: row.catalog_id,
    name: row.name,
    japanese_name: null,
    set_name: row.set_name,
    set_id: row.set_code,
    number: row.number,
    rarity: row.rarity,
    image_url: row.image_large_url ?? row.image_small_url,
    language: (row.language_code ?? "en").toLowerCase(),
    updated_at: row.catalog_synced_at ?? new Date().toISOString(),
  }
}

function collectorNumberMatches(stored: string, detected: string): boolean {
  const left = stored.split("/")[0] ?? stored
  return left.trim().toLowerCase() === detected.trim().toLowerCase()
}

function buildSetHintOrFilter(setHint: string): string {
  const safeSet = sanitizeCatalogSearchToken(setHint)
  const pattern = `%${safeSet}%`
  const resolvedSetId = resolveBinderSetIdHint(setHint)
  const parts = [
    `set_name.ilike.${pattern}`,
    `set_code.ilike.%${safeSet}%`,
    `set_code.ilike.%sv${safeSet}%`,
  ]
  if (resolvedSetId) parts.push(`set_code.eq.${resolvedSetId}`)
  return parts.join(",")
}

async function fetchBySetHint(
  supabase: SupabaseClient,
  setHint: string,
  fetchLimit: number,
): Promise<ScrydexCatalogCardRow[]> {
  const { data, error } = await supabase
    .from("catalog_cards")
    .select(CARD_SELECT)
    .eq("game", "pokemon")
    .or(buildSetHintOrFilter(setHint))
    .order("name", { ascending: true })
    .limit(fetchLimit)

  if (error) throw error
  return (data ?? []) as ScrydexCatalogCardRow[]
}

async function fetchBySetAndNumber(
  supabase: SupabaseClient,
  setHint: string,
  number: string,
  fetchLimit: number,
): Promise<ScrydexCatalogCardRow[]> {
  const byNumber = await fetchByNumber(supabase, number, fetchLimit)
  return byNumber.filter((row) =>
    catalogRowMatchesSetHint(
      { set_name: row.set_name, set_code: row.set_code, catalog_id: row.catalog_id },
      setHint,
    ),
  )
}

async function fetchByNumber(
  supabase: SupabaseClient,
  number: string,
  fetchLimit: number,
): Promise<ScrydexCatalogCardRow[]> {
  const safeNumber = sanitizeCatalogSearchToken(number)
  const { data, error } = await supabase
    .from("catalog_cards")
    .select(CARD_SELECT)
    .eq("game", "pokemon")
    .or(`number.eq.${safeNumber},number.ilike.${safeNumber}/%`)
    .order("name", { ascending: true })
    .limit(fetchLimit)

  if (error) throw error

  return ((data ?? []) as ScrydexCatalogCardRow[]).filter((row) =>
    collectorNumberMatches(row.number, number),
  )
}

async function fetchByText(
  supabase: SupabaseClient,
  query: string,
  fetchLimit: number,
): Promise<ScrydexCatalogCardRow[]> {
  const tokens = parseBinderSearchTokens(query)
  const text = tokens.name || query.trim()
  const parts = text.split(/\s+/).filter((part) => part.length >= 2 || /^\d+$/.test(part))

  if (parts.length > 1) {
    const fullPatternRows = await fetchFullPattern(supabase, text, fetchLimit)
    if (fullPatternRows.length > 0) {
      return fullPatternRows.filter((row) => catalogRowMatchesQuery(scrydexRowToLegacyRow(row), query))
    }
  }

  const primary = sanitizeCatalogSearchToken(
    parts.sort((a, b) => b.length - a.length)[0] ?? text,
  )
  if (!primary) return []

  const pattern = `%${primary}%`
  const { data, error } = await supabase
    .from("catalog_cards")
    .select(CARD_SELECT)
    .eq("game", "pokemon")
    .or(`name.ilike.${pattern},set_name.ilike.${pattern},number.ilike.${pattern}`)
    .order("name", { ascending: true })
    .limit(fetchLimit)

  if (error) throw error

  let rows = (data ?? []) as ScrydexCatalogCardRow[]
  if (parts.length > 1) {
    rows = rows.filter((row) => catalogRowMatchesQuery(scrydexRowToLegacyRow(row), query))
  }
  return rows
}

async function fetchFullPattern(
  supabase: SupabaseClient,
  query: string,
  fetchLimit: number,
): Promise<ScrydexCatalogCardRow[]> {
  const pattern = `%${sanitizeCatalogSearchToken(query)}%`
  const { data, error } = await supabase
    .from("catalog_cards")
    .select(CARD_SELECT)
    .eq("game", "pokemon")
    .or(`name.ilike.${pattern},set_name.ilike.${pattern},number.ilike.${pattern}`)
    .order("name", { ascending: true })
    .limit(fetchLimit)

  if (error) throw error
  return (data ?? []) as ScrydexCatalogCardRow[]
}

async function fetchByNameAndNumber(
  supabase: SupabaseClient,
  name: string,
  number: string,
  fetchLimit: number,
): Promise<ScrydexCatalogCardRow[]> {
  const simplified = simplifyCardName(name).trim()
  const nameTokens = simplified.split(/\s+/).filter((token) => token.length > 0)

  const byName = await fetchByText(supabase, name, fetchLimit)
  let rows = byName.filter((row) => collectorNumberMatches(row.number, number))
  if (rows.length > 0) return rows

  const byNumber = await fetchByNumber(supabase, number, fetchLimit)
  rows = byNumber.filter((row) => {
    const haystack = row.name.toLowerCase()
    return nameTokens.every((token) => haystack.includes(token.toLowerCase()))
  })
  if (rows.length > 0) return rows

  const safeNumber = sanitizeCatalogSearchToken(number)
  const primaryToken = nameTokens.find((token) => token.length > 1) ?? simplified
  const safeToken = sanitizeCatalogSearchToken(primaryToken)

  const { data, error } = await supabase
    .from("catalog_cards")
    .select(CARD_SELECT)
    .eq("game", "pokemon")
    .ilike("name", `%${safeToken}%`)
    .or(`number.eq.${safeNumber},number.ilike.${safeNumber}/%`)
    .order("name", { ascending: true })
    .limit(fetchLimit)

  if (error) throw error

  return ((data ?? []) as ScrydexCatalogCardRow[]).filter((row) => {
    if (!collectorNumberMatches(row.number, number)) return false
    if (nameTokens.length <= 1) return true
    return catalogRowMatchesQuery(scrydexRowToLegacyRow(row), name)
  })
}

async function fetchByNameAndSetHint(
  supabase: SupabaseClient,
  name: string,
  setHint: string,
  fetchLimit: number,
): Promise<ScrydexCatalogCardRow[]> {
  const byName = await fetchByText(supabase, name, fetchLimit)
  return byName.filter((row) =>
    catalogRowMatchesSetHint(
      { set_name: row.set_name, set_code: row.set_code, catalog_id: row.catalog_id },
      setHint,
    ),
  )
}

/** Token-aware catalog_cards search — matches the public.cards search behavior. */
export async function queryScrydexCatalogSearchRows(
  supabase: SupabaseClient,
  query: string,
  fetchLimit: number,
): Promise<ScrydexCatalogCardRow[]> {
  const q = query.trim()
  if (!catalogSearchMinLength(q)) return []

  const tokens = parseBinderSearchTokens(q)
  let rows: ScrydexCatalogCardRow[] = []

  if (tokens.setHint && tokens.number) {
    rows = await fetchBySetAndNumber(supabase, tokens.setHint, tokens.number, fetchLimit)
  } else if (tokens.setHint && !tokens.number) {
    rows = await fetchBySetHint(supabase, tokens.setHint, fetchLimit)
  } else if (tokens.name && tokens.setHint) {
    rows = await fetchByNameAndSetHint(supabase, tokens.name, tokens.setHint, fetchLimit)
  } else if (tokens.name && tokens.number) {
    rows = await fetchByNameAndNumber(supabase, tokens.name, tokens.number, fetchLimit)
    if (rows.length === 0) {
      const byName = await fetchByText(supabase, tokens.name, fetchLimit)
      rows = byName.filter((row) => cardNumberMatches(row.number, tokens.number!))
    }
  } else if (tokens.number && !tokens.name) {
    rows = await fetchByNumber(supabase, tokens.number, fetchLimit)
  } else {
    rows = await fetchByText(supabase, q, fetchLimit)
  }

  if (rows.length === 0) {
    rows = await fetchFullPattern(supabase, q, fetchLimit)
  }

  return rows
}
