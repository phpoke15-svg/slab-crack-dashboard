import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { CardLanguage } from "@/lib/types/pokemon-api"
import type { CardIdLegacyMapRow, LegacyIdResolutionStatus } from "@/lib/pricing/types"

function parseLanguage(value: unknown): CardLanguage | null {
  const lang = String(value ?? "").trim().toLowerCase()
  if (lang === "en" || lang === "ja") return lang
  return null
}

function rowToLegacyMap(row: Record<string, unknown>): CardIdLegacyMapRow {
  return {
    legacy_pc_id: String(row.legacy_pc_id),
    new_poke_id: row.new_poke_id == null ? null : String(row.new_poke_id),
    tcggo_id: row.tcggo_id == null ? null : Number(row.tcggo_id),
    tcgplayer_id: row.tcgplayer_id == null ? null : Number(row.tcgplayer_id),
    tcg_id: row.tcg_id == null ? null : String(row.tcg_id),
    card_name: row.card_name == null ? null : String(row.card_name),
    card_set: row.card_set == null ? null : String(row.card_set),
    card_number: row.card_number == null ? null : String(row.card_number),
    language: parseLanguage(row.language),
    resolution_status: String(row.resolution_status ?? "pending") as LegacyIdResolutionStatus,
    resolution_error: row.resolution_error == null ? null : String(row.resolution_error),
    resolved_at: row.resolved_at == null ? null : String(row.resolved_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function getLegacyMapByPcId(legacyPcId: string): Promise<CardIdLegacyMapRow | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("card_id_legacy_map")
    .select("*")
    .eq("legacy_pc_id", legacyPcId)
    .maybeSingle()

  if (error) {
    if (error.code === "42P01") return null
    throw error
  }
  return data ? rowToLegacyMap(data as Record<string, unknown>) : null
}

export async function listPendingLegacyMaps(limit = 500): Promise<CardIdLegacyMapRow[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("card_id_legacy_map")
    .select("*")
    .in("resolution_status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) {
    if (error.code === "42P01") return []
    throw error
  }
  return (data ?? []).map((row) => rowToLegacyMap(row as Record<string, unknown>))
}

export async function upsertLegacyMapSeed(
  rows: Array<{
    legacyPcId: string
    cardName?: string | null
    cardSet?: string | null
    cardNumber?: string | null
  }>,
): Promise<number> {
  if (!isSupabaseConfigured() || rows.length === 0) return 0
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const payload = rows.map((row) => ({
    legacy_pc_id: row.legacyPcId,
    card_name: row.cardName ?? null,
    card_set: row.cardSet ?? null,
    card_number: row.cardNumber ?? null,
    resolution_status: "pending",
    updated_at: now,
  }))

  const { error } = await supabase.from("card_id_legacy_map").upsert(payload, {
    onConflict: "legacy_pc_id",
    ignoreDuplicates: true,
  })

  if (error) {
    if (error.code === "42P01") return 0
    throw error
  }
  return payload.length
}

export async function saveLegacyMapResolution(input: {
  legacyPcId: string
  newPokeId: string
  tcgGoId?: number | null
  tcgplayerId?: number | null
  tcgId: string
  language?: CardLanguage | null
  cardName?: string | null
  cardSet?: string | null
  cardNumber?: string | null
  status?: LegacyIdResolutionStatus
  error?: string | null
}): Promise<void> {
  if (!isSupabaseConfigured()) return
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const resolved = input.status ?? "resolved"

  const { error } = await supabase.from("card_id_legacy_map").upsert(
    {
      legacy_pc_id: input.legacyPcId,
      new_poke_id: input.newPokeId,
      tcggo_id: input.tcgGoId ?? null,
      tcgplayer_id: input.tcgplayerId ?? null,
      tcg_id: input.tcgId,
      card_name: input.cardName ?? null,
      card_set: input.cardSet ?? null,
      card_number: input.cardNumber ?? null,
      language: input.language ?? null,
      resolution_status: resolved,
      resolution_error: input.error ?? null,
      resolved_at: resolved === "resolved" ? now : null,
      updated_at: now,
    },
    { onConflict: "legacy_pc_id" },
  )

  if (error) {
    if (error.code === "42P01") return
    throw error
  }
}

export async function getLegacyMapErrorSummary(limit = 5000): Promise<Map<string, number>> {
  if (!isSupabaseConfigured()) return new Map()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("card_id_legacy_map")
    .select("resolution_status, resolution_error")
    .in("resolution_status", ["failed", "pending"])
    .limit(limit)

  if (error) {
    if (error.code === "42P01") return new Map()
    throw error
  }

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const status = String(row.resolution_status ?? "pending")
    const key =
      status === "pending"
        ? "pending (not yet resolved)"
        : String(row.resolution_error ?? "failed (no message)").slice(0, 200)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

export async function resetFailedLegacyMaps(): Promise<number> {
  if (!isSupabaseConfigured()) return 0
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("card_id_legacy_map")
    .update({
      resolution_status: "pending",
      resolution_error: null,
      resolved_at: null,
      updated_at: now,
    })
    .eq("resolution_status", "failed")
    .select("legacy_pc_id")

  if (error) {
    if (error.code === "42P01") return 0
    throw error
  }
  return data?.length ?? 0
}

export async function markLegacyMapFailed(legacyPcId: string, message: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await supabase.from("card_id_legacy_map").upsert(
    {
      legacy_pc_id: legacyPcId,
      new_poke_id: null,
      resolution_status: "failed",
      resolution_error: message,
      resolved_at: null,
      updated_at: now,
    },
    { onConflict: "legacy_pc_id" },
  )
  if (error && error.code !== "42P01") throw error
}
