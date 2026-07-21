/**
 * Seed catalog_cards + catalog_id_legacy_map from the existing public.cards table.
 * No Scrydex API credits required — metadata only.
 *
 * Usage:
 *   npx tsx scripts/seed-scrydex-from-cards.ts           # dry-run
 *   npx tsx scripts/seed-scrydex-from-cards.ts --apply
 *   npx tsx scripts/seed-scrydex-from-cards.ts --apply --limit=500
 *
 * Prerequisites:
 *   1. Run supabase/scrydex-multi-tcg.sql in Supabase
 *   2. Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { legacyPokeIdToCatalogId } from "@/lib/scrydex/constants"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

type LegacyCardRow = {
  id: string
  name: string
  set_name: string
  set_id: string
  number: string
  rarity: string | null
  image_url: string | null
  language: string
}

function stripQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

async function loadEnvFile(relativePath: string, override = false) {
  const path = join(root, relativePath)
  if (!existsSync(path)) return

  const raw = await readFile(path, "utf-8")
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = stripQuotes(trimmed.slice(eq + 1))
    if (!key) continue
    if (override || !process.env[key]?.trim()) {
      process.env[key] = value
    }
  }
}

function parseCli(argv: string[]) {
  const apply = argv.includes("--apply")
  const limitArg = argv.find((arg) => arg.startsWith("--limit="))
  const limitFlagIdx = argv.indexOf("--limit")
  const limitRaw =
    limitArg?.split("=")[1] ??
    (limitFlagIdx >= 0 ? argv[limitFlagIdx + 1] : undefined) ??
    "1000"
  const limit = Math.min(Math.max(Number(limitRaw) || 1000, 1), 5000)
  return { apply, limit }
}

function cardToCatalogRow(row: LegacyCardRow) {
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

async function main() {
  await loadEnvFile(".env")
  await loadEnvFile(".env.local", true)

  const { apply, limit } = parseCli(process.argv.slice(2))
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from("cards")
    .select("id, name, set_name, set_id, number, rarity, image_url, language")
    .like("id", "poke-%")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  const catalogRows = ((data ?? []) as LegacyCardRow[])
    .map(cardToCatalogRow)
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  const legacyRows = catalogRows.map((row) => ({
    legacy_id: String(row.metadata.legacy_id),
    catalog_id: row.catalog_id,
    legacy_source: "poke-tcggo",
  }))

  console.log(`[seed-scrydex] Found ${catalogRows.length} poke-* cards to seed (limit ${limit})`)
  console.log(`[seed-scrydex] Mode: ${apply ? "APPLY" : "DRY-RUN"}`)

  if (!apply) {
    console.log("[seed-scrydex] Sample rows:")
    for (const row of catalogRows.slice(0, 5)) {
      console.log(`  ${row.metadata.legacy_id} → ${row.catalog_id} (${row.name})`)
    }
    return
  }

  const chunkSize = 100
  let catalogUpserted = 0
  let legacyUpserted = 0

  for (let i = 0; i < catalogRows.length; i += chunkSize) {
    const chunk = catalogRows.slice(i, i + chunkSize)
    const { error: catalogError } = await supabase.from("catalog_cards").upsert(chunk)
    if (catalogError?.code === "42P01") {
      console.error("[seed-scrydex] catalog_cards table missing — run supabase/scrydex-multi-tcg.sql first")
      process.exit(1)
    }
    if (catalogError) throw catalogError
    catalogUpserted += chunk.length
  }

  for (let i = 0; i < legacyRows.length; i += chunkSize) {
    const chunk = legacyRows.slice(i, i + chunkSize)
    const { error: legacyError } = await supabase.from("catalog_id_legacy_map").upsert(chunk)
    if (legacyError?.code === "42P01") {
      console.error("[seed-scrydex] catalog_id_legacy_map table missing — run supabase/scrydex-multi-tcg.sql first")
      process.exit(1)
    }
    if (legacyError) throw legacyError
    legacyUpserted += chunk.length
  }

  console.log(`[seed-scrydex] Upserted ${catalogUpserted} catalog_cards rows`)
  console.log(`[seed-scrydex] Upserted ${legacyUpserted} catalog_id_legacy_map rows`)
}

main().catch((error) => {
  console.error("[seed-scrydex] failed:", error)
  process.exit(1)
})
