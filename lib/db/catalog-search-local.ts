import type { SupabaseClient } from "@supabase/supabase-js"
import { mergeBinderSearchResults } from "@/lib/trade-binder/binder-search"
import {
  cardNumberMatches,
  parseBinderSearchTokens,
  resolveBinderSetIdHint,
} from "@/lib/trade-binder/pokemon-tcg"
import { catalogRowMatchesSetHint } from "@/lib/db/catalog-set-match"
import { cleanNumber, simplifyCardName } from "@/lib/slabcrack/identify-parse"
import type { CatalogCardRow, CatalogSearchHit } from "@/lib/db/cards-catalog"

const CARD_SELECT =
  "id, name, set_name, set_id, number, rarity, image_url, current_price_raw, current_price_psa10, scrydex_id, card_slug, set_slug"

const SEARCH_PRICE_ORDER = {
  column: "current_price_raw",
  ascending: false,
  nullsFirst: false,
} as const

export function sanitizeCatalogSearchToken(value: string): string {
  return value.replace(/[%_]/g, "")
}

/** Lowercase and strip special characters to align with indexed `clean_name`. */
export function normalizeSearchCleanName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
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

function orderSearchResults<T extends { order: (...args: never[]) => T }>(query: T): T {
  return query.order(SEARCH_PRICE_ORDER.column, {
    ascending: SEARCH_PRICE_ORDER.ascending,
    nullsFirst: SEARCH_PRICE_ORDER.nullsFirst,
  })
}

function resolveCleanNamePrefix(query: string, sqlQuery?: string): string {
  const normalized = sqlQuery ?? normalizeSearchCleanName(query)
  const tokens = parseBinderSearchTokens(query)
  const text = tokens.name || query.trim()
  const parts = text.split(/\s+/).filter((part) => part.length >= 2 || /^\d+$/.test(part))
  const primary = parts.sort((a, b) => b.length - a.length)[0] ?? text
  const fromText = normalizeSearchCleanName(primary)
  return sanitizeCatalogSearchToken(fromText || normalized)
}

async function fetchByNameTokenFallback(
  supabase: SupabaseClient,
  prefix: string,
  fetchLimit: number,
): Promise<CatalogCardRow[]> {
  const token = prefix.split(/\s+/).find((part) => part.length >= 2) ?? prefix.split(/\s+/)[0] ?? prefix
  const safeToken = sanitizeCatalogSearchToken(token)
  if (!safeToken) return []

  const pattern = `%${safeToken}%`
  const { data, error } = await orderSearchResults(
    supabase.from("cards").select(CARD_SELECT).ilike("name", pattern),
  ).limit(fetchLimit)

  if (error) throw error
  return (data ?? []) as CatalogCardRow[]
}

async function fetchByCleanNamePrefix(
  supabase: SupabaseClient,
  prefix: string,
  fetchLimit: number,
): Promise<CatalogCardRow[]> {
  const safePrefix = sanitizeCatalogSearchToken(prefix)
  if (!safePrefix) return []

  const { data, error } = await orderSearchResults(
    supabase.from("cards").select(CARD_SELECT).like("clean_name", `${safePrefix}%`),
  ).limit(fetchLimit)

  if (error) {
    if (error.code === "42703") {
      return fetchByNameTokenFallback(supabase, safePrefix, fetchLimit)
    }
    throw error
  }

  const rows = (data ?? []) as CatalogCardRow[]
  if (rows.length > 0) return rows
  return fetchByNameTokenFallback(supabase, safePrefix, fetchLimit)
}

async function fetchBySetHint(
  supabase: SupabaseClient,
  setHint: string,
  fetchLimit: number,
): Promise<CatalogCardRow[]> {
  const { data, error } = await orderSearchResults(
    supabase.from("cards").select(CARD_SELECT).or(buildSetHintOrFilter(setHint)),
  ).limit(fetchLimit)

  if (error) throw error
  return (data ?? []) as CatalogCardRow[]
}

async function fetchBySetAndNumber(
  supabase: SupabaseClient,
  setHint: string,
  number: string,
  fetchLimit: number,
): Promise<CatalogCardRow[]> {
  const byNumber = await fetchByNumber(supabase, number, fetchLimit)
  return byNumber.filter((row) => catalogRowMatchesSetHint(row, setHint))
}

async function fetchByNameAndNumber(
  supabase: SupabaseClient,
  name: string,
  number: string,
  fetchLimit: number,
  sqlQuery?: string,
): Promise<CatalogCardRow[]> {
  const simplified = simplifyCardName(name).trim()
  const nameTokens = simplified.split(/\s+/).filter((token) => token.length > 0)

  const byName = await fetchByText(supabase, name, fetchLimit, sqlQuery)
  let rows = byName.filter((row) => collectorNumberMatches(row.number, number))
  if (rows.length > 0) return rows

  const byNumber = await fetchByNumber(supabase, number, fetchLimit)
  rows = byNumber.filter((row) => {
    const haystack = `${row.name} ${row.japanese_name ?? ""}`.toLowerCase()
    return nameTokens.every((token) => haystack.includes(token.toLowerCase()))
  })
  if (rows.length > 0) return rows

  const safeNumber = sanitizeCatalogSearchToken(number)
  const prefix = resolveCleanNamePrefix(name, sqlQuery)
  if (!prefix) return []

  const { data, error } = await orderSearchResults(
    supabase
      .from("cards")
      .select(CARD_SELECT)
      .like("clean_name", `${prefix}%`)
      .or(`number.eq.${safeNumber},number.ilike.${safeNumber}/%`),
  ).limit(fetchLimit)

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
  const { data, error } = await orderSearchResults(
    supabase
      .from("cards")
      .select(CARD_SELECT)
      .or(`number.eq.${safeNumber},number.ilike.${safeNumber}/%`),
  ).limit(fetchLimit)

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
  sqlQuery?: string,
): Promise<CatalogCardRow[]> {
  const byName = await fetchByText(supabase, name, fetchLimit, sqlQuery)
  return byName.filter((row) => catalogRowMatchesSetHint(row, setHint))
}

async function fetchByText(
  supabase: SupabaseClient,
  query: string,
  fetchLimit: number,
  sqlQuery?: string,
): Promise<CatalogCardRow[]> {
  const prefix = resolveCleanNamePrefix(query, sqlQuery)
  if (!prefix) return []

  const rows = await fetchByCleanNamePrefix(supabase, prefix, fetchLimit)
  const tokens = parseBinderSearchTokens(query)
  const text = tokens.name || query.trim()
  const parts = text.split(/\s+/).filter((part) => part.length >= 2 || /^\d+$/.test(part))

  if (parts.length > 1) {
    return rows.filter((row) => catalogRowMatchesQuery(row, query))
  }

  return rows
}

async function fetchFullPattern(
  supabase: SupabaseClient,
  query: string,
  fetchLimit: number,
  sqlQuery?: string,
): Promise<CatalogCardRow[]> {
  const prefix = sanitizeCatalogSearchToken(sqlQuery ?? normalizeSearchCleanName(query))
  if (!prefix) return []
  return fetchByCleanNamePrefix(supabase, prefix, fetchLimit)
}

/** Name + collector number lookup for scanner OCR / vision matching. */
export async function queryCatalogRowsForDetected(
  supabase: SupabaseClient,
  detected: { cardName: string; cardNumber: string },
  limit: number,
): Promise<CatalogCardRow[]> {
  const name = simplifyCardName(detected.cardName).trim()
  const number = cleanNumber(detected.cardNumber)
  if (!number) return []

  const fetchLimit = Math.min(Math.max(limit, 1), 40)
  if (!name) return fetchByNumber(supabase, number, fetchLimit)
  return fetchByNameAndNumber(supabase, name, number, fetchLimit)
}

export async function queryCatalogSearchRows(
  supabase: SupabaseClient,
  query: string,
  fetchLimit: number,
  options?: { sqlQuery?: string },
): Promise<CatalogCardRow[]> {
  const q = query.trim()
  const sqlQuery = options?.sqlQuery
  const tokens = parseBinderSearchTokens(q)
  let rows: CatalogCardRow[] = []

  if (tokens.setHint && tokens.number) {
    rows = await fetchBySetAndNumber(supabase, tokens.setHint, tokens.number, fetchLimit)
  } else if (tokens.setHint && !tokens.number) {
    rows = await fetchBySetHint(supabase, tokens.setHint, fetchLimit)
  } else if (tokens.name && tokens.setHint) {
    rows = await fetchByNameAndSetHint(supabase, tokens.name, tokens.setHint, fetchLimit, sqlQuery)
  } else if (tokens.name && tokens.number) {
    rows = await fetchByNameAndNumber(supabase, tokens.name, tokens.number, fetchLimit, sqlQuery)
    if (rows.length === 0) {
      const byName = await fetchByText(supabase, tokens.name, fetchLimit, sqlQuery)
      rows = byName.filter((row) => cardNumberMatches(row.number, tokens.number!))
    }
  } else if (tokens.number && !tokens.name) {
    rows = await fetchByNumber(supabase, tokens.number, fetchLimit)
  } else {
    rows = await fetchByText(supabase, q, fetchLimit, sqlQuery)
  }

  if (rows.length === 0) {
    rows = await fetchFullPattern(supabase, q, fetchLimit, sqlQuery)
  }

  return rows
}
