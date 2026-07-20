import type { SupabaseClient } from "@supabase/supabase-js"
import { mergeBinderSearchResults } from "@/lib/trade-binder/binder-search"
import {
  cardNumberMatches,
  parseBinderSearchTokens,
  resolveBinderSetIdHint,
} from "@/lib/trade-binder/pokemon-tcg"
import { simplifyCardName } from "@/lib/slabcrack/identify-parse"
import type { CatalogCardRow, CatalogSearchHit } from "@/lib/db/cards-catalog"

const CARD_SELECT =
  "id, name, japanese_name, set_name, set_id, number, rarity, image_url, language, updated_at"

export function sanitizeCatalogSearchToken(value: string): string {
  return value.replace(/[%_]/g, "")
}

export function catalogSearchMinLength(query: string): boolean {
  const q = query.trim()
  if (!q) return false
  const tokens = parseBinderSearchTokens(q)
  if (tokens.setHint) return true
  if (tokens.number && !tokens.name) return tokens.number.length > 0
  return q.length >= 2
}

export function catalogRowMatchesQuery(row: CatalogCardRow, query: string): boolean {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length <= 1) return true

  const haystack = `${row.name} ${row.set_name} ${row.japanese_name ?? ""} ${row.number}`.toLowerCase()
  return tokens.every((token) => {
    const normalized = token.replace(/^#/, "")
    if (/^\d+$/.test(normalized)) {
      return cardNumberMatches(row.number, normalized)
    }
    return haystack.includes(normalized)
  })
}

export function rankCatalogSearchHits(
  hits: CatalogSearchHit[],
  query: string,
  limit: number,
): CatalogSearchHit[] {
  if (hits.length === 0) return []

  const ranked = mergeBinderSearchResults(
    hits.map((hit) => ({
      id: hit.id,
      name: hit.name,
      set: hit.setName,
      rarity: hit.rarity ?? "Common",
      image: hit.imageUrl,
      cardNumber: hit.number,
      rawPrice: hit.rawPrice,
    })),
    query,
  )

  const byId = new Map(hits.map((hit) => [hit.id, hit]))
  return ranked
    .map((card) => byId.get(card.id))
    .filter((hit): hit is CatalogSearchHit => hit != null)
    .slice(0, limit)
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
    `set_id.ilike.%${safeSet}%`,
    `set_id.ilike.%sv${safeSet}%`,
  ]
  if (resolvedSetId) parts.push(`set_id.eq.${resolvedSetId}`)
  return parts.join(",")
}

async function fetchBySetHint(
  supabase: SupabaseClient,
  setHint: string,
  fetchLimit: number,
): Promise<CatalogCardRow[]> {
  const { data, error } = await supabase
    .from("cards")
    .select(CARD_SELECT)
    .or(buildSetHintOrFilter(setHint))
    .order("name", { ascending: true })
    .limit(fetchLimit)

  if (error) throw error
  return (data ?? []) as CatalogCardRow[]
}

async function fetchBySetAndNumber(
  supabase: SupabaseClient,
  setHint: string,
  number: string,
  fetchLimit: number,
): Promise<CatalogCardRow[]> {
  const safeNumber = sanitizeCatalogSearchToken(number)
  const { data, error } = await supabase
    .from("cards")
    .select(CARD_SELECT)
    .or(buildSetHintOrFilter(setHint))
    .or(`number.eq.${safeNumber},number.ilike.${safeNumber}/%`)
    .order("name", { ascending: true })
    .limit(fetchLimit)

  if (error) throw error

  return ((data ?? []) as CatalogCardRow[]).filter((row) =>
    collectorNumberMatches(row.number, number),
  )
}

async function fetchByNameAndNumber(
  supabase: SupabaseClient,
  name: string,
  number: string,
  fetchLimit: number,
): Promise<CatalogCardRow[]> {
  const simplified = simplifyCardName(name).trim()
  const nameTokens = simplified.split(/\s+/).filter((token) => token.length > 0)

  const byName = await fetchByText(supabase, name, fetchLimit)
  let rows = byName.filter((row) => collectorNumberMatches(row.number, number))
  if (rows.length > 0) return rows

  const byNumber = await fetchByNumber(supabase, number, fetchLimit)
  rows = byNumber.filter((row) => {
    const haystack = `${row.name} ${row.japanese_name ?? ""}`.toLowerCase()
    return nameTokens.every((token) => haystack.includes(token.toLowerCase()))
  })
  if (rows.length > 0) return rows

  const safeNumber = sanitizeCatalogSearchToken(number)
  const primaryToken = nameTokens.find((token) => token.length > 1) ?? simplified
  const safeToken = sanitizeCatalogSearchToken(primaryToken)

  const { data, error } = await supabase
    .from("cards")
    .select(CARD_SELECT)
    .ilike("name", `%${safeToken}%`)
    .or(`number.eq.${safeNumber},number.ilike.${safeNumber}/%`)
    .order("name", { ascending: true })
    .limit(fetchLimit)

  if (error) throw error

  return ((data ?? []) as CatalogCardRow[]).filter((row) => {
    if (!collectorNumberMatches(row.number, number)) return false
    if (nameTokens.length <= 1) return true
    return catalogRowMatchesQuery(row, name)
  })
}

async function fetchByNumber(
  supabase: SupabaseClient,
  number: string,
  fetchLimit: number,
): Promise<CatalogCardRow[]> {
  const safeNumber = sanitizeCatalogSearchToken(number)
  const { data, error } = await supabase
    .from("cards")
    .select(CARD_SELECT)
    .or(`number.eq.${safeNumber},number.ilike.${safeNumber}/%`)
    .order("name", { ascending: true })
    .limit(fetchLimit)

  if (error) throw error

  return ((data ?? []) as CatalogCardRow[]).filter((row) =>
    collectorNumberMatches(row.number, number),
  )
}

async function fetchByNameAndSetHint(
  supabase: SupabaseClient,
  name: string,
  setHint: string,
  fetchLimit: number,
): Promise<CatalogCardRow[]> {
  const simplified = simplifyCardName(name).trim()
  const nameTokens = simplified.split(/\s+/).filter((token) => token.length > 0)
  const primaryToken = nameTokens.find((token) => token.length > 1) ?? simplified
  const safeToken = sanitizeCatalogSearchToken(primaryToken)

  const { data, error } = await supabase
    .from("cards")
    .select(CARD_SELECT)
    .or(buildSetHintOrFilter(setHint))
    .or(`name.ilike.%${safeToken}%,japanese_name.ilike.%${safeToken}%`)
    .order("name", { ascending: true })
    .limit(fetchLimit)

  if (error) throw error

  return ((data ?? []) as CatalogCardRow[]).filter((row) => {
    if (nameTokens.length <= 1) return true
    return catalogRowMatchesQuery(row, name)
  })
}

async function fetchByText(
  supabase: SupabaseClient,
  query: string,
  fetchLimit: number,
): Promise<CatalogCardRow[]> {
  const tokens = parseBinderSearchTokens(query)
  const text = tokens.name || query.trim()
  const parts = text.split(/\s+/).filter((part) => part.length >= 2 || /^\d+$/.test(part))

  if (parts.length > 1) {
    const fullPatternRows = await fetchFullPattern(supabase, text, fetchLimit)
    if (fullPatternRows.length > 0) {
      return fullPatternRows.filter((row) => catalogRowMatchesQuery(row, query))
    }
  }

  const primary = sanitizeCatalogSearchToken(
    parts.sort((a, b) => b.length - a.length)[0] ?? text,
  )
  if (!primary) return []

  const pattern = `%${primary}%`
  const { data, error } = await supabase
    .from("cards")
    .select(CARD_SELECT)
    .or(
      `name.ilike.${pattern},japanese_name.ilike.${pattern},set_name.ilike.${pattern},number.ilike.${pattern}`,
    )
    .order("name", { ascending: true })
    .limit(fetchLimit)

  if (error) throw error

  let rows = (data ?? []) as CatalogCardRow[]
  if (parts.length > 1) {
    rows = rows.filter((row) => catalogRowMatchesQuery(row, query))
  }
  return rows
}

async function fetchFullPattern(
  supabase: SupabaseClient,
  query: string,
  fetchLimit: number,
): Promise<CatalogCardRow[]> {
  const pattern = `%${sanitizeCatalogSearchToken(query)}%`
  const { data, error } = await supabase
    .from("cards")
    .select(CARD_SELECT)
    .or(
      `name.ilike.${pattern},japanese_name.ilike.${pattern},set_name.ilike.${pattern},number.ilike.${pattern}`,
    )
    .order("name", { ascending: true })
    .limit(fetchLimit)

  if (error) throw error
  return (data ?? []) as CatalogCardRow[]
}

export async function queryCatalogSearchRows(
  supabase: SupabaseClient,
  query: string,
  fetchLimit: number,
): Promise<CatalogCardRow[]> {
  const q = query.trim()
  const tokens = parseBinderSearchTokens(q)
  let rows: CatalogCardRow[] = []

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
