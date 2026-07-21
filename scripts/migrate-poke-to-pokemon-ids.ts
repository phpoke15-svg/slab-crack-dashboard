/**
 * Build catalog_id_legacy_map entries for poke-* → pokemon-* ids.
 * Ensures matching catalog_cards rows exist first (FK-safe).
 * Optionally copies card_prices raw values into prices_raw when Scrydex prices are absent.
 *
 * Usage:
 *   npx tsx scripts/migrate-poke-to-pokemon-ids.ts           # dry-run
 *   npx tsx scripts/migrate-poke-to-pokemon-ids.ts --apply
 *   npx tsx scripts/migrate-poke-to-pokemon-ids.ts --apply --copy-prices
 *
 * Prerequisites:
 *   1. Run supabase/scrydex-multi-tcg.sql
 *   2. NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
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
  return {
    apply: argv.includes("--apply"),
    copyPrices: argv.includes("--copy-prices"),
    limit: Math.min(
      Math.max(Number(argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? 1000), 1),
      5000,
    ),
  }
}

async function main() {
  await loadEnvFile(".env")
  await loadEnvFile(".env.local", true)

  const { apply, copyPrices, limit } = parseCli(process.argv.slice(2))
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, name, set_name, set_id, number, rarity, image_url, language")
    .like("id", "poke-%")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (cardsError) throw cardsError

  const catalogRows = ((cards ?? []) as LegacyCardRow[])
    .map(cardToCatalogRow)
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  const mappings = catalogRows.map((row) => ({
    legacy_id: String(row.metadata.legacy_id),
    catalog_id: row.catalog_id,
    legacy_source: "poke-tcggo",
  }))

  console.log(`[migrate-poke] ${mappings.length} legacy mappings (limit ${limit})`)
  console.log(`[migrate-poke] Mode: ${apply ? "APPLY" : "DRY-RUN"} copy-prices=${copyPrices}`)

  if (!apply) {
    for (const row of mappings.slice(0, 5)) {
      console.log(`  ${row.legacy_id} → ${row.catalog_id}`)
    }
    return
  }

  const chunkSize = 100
  for (let i = 0; i < catalogRows.length; i += chunkSize) {
    const chunk = catalogRows.slice(i, i + chunkSize)
    const { error: catalogError } = await supabase.from("catalog_cards").upsert(chunk)
    if (catalogError?.code === "42P01") {
      console.error("[migrate-poke] Run supabase/scrydex-multi-tcg.sql first")
      process.exit(1)
    }
    if (catalogError) throw catalogError
  }

  console.log(`[migrate-poke] Upserted ${catalogRows.length} catalog_cards rows`)

  for (let i = 0; i < mappings.length; i += chunkSize) {
    const chunk = mappings.slice(i, i + chunkSize)
    const { error } = await supabase.from("catalog_id_legacy_map").upsert(chunk)
    if (error?.code === "42P01") {
      console.error("[migrate-poke] Run supabase/scrydex-multi-tcg.sql first")
      process.exit(1)
    }
    if (error) throw error
  }

  console.log(`[migrate-poke] Upserted ${mappings.length} catalog_id_legacy_map rows`)

  if (!copyPrices) return

  const catalogIds = mappings.map((row) => row.catalog_id)
  const { data: existingPrices, error: existingError } = await supabase
    .from("prices_raw")
    .select("catalog_id")
    .in("catalog_id", catalogIds)

  if (existingError?.code === "42P01") {
    console.warn("[migrate-poke] prices_raw table missing — skipped price copy")
    return
  }
  if (existingError) throw existingError

  const pricedCatalogIds = new Set((existingPrices ?? []).map((row) => String(row.catalog_id)))
  const legacyIds = mappings.filter((row) => !pricedCatalogIds.has(row.catalog_id)).map((row) => row.legacy_id)

  if (legacyIds.length === 0) {
    console.log("[migrate-poke] All mapped cards already have Scrydex raw prices")
    return
  }

  const { data: cardPrices, error: priceError } = await supabase
    .from("card_prices")
    .select("card_id, raw_price, synced_at")
    .in("card_id", legacyIds)
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

  for (let i = 0; i < priceRows.length; i += chunkSize) {
    const chunk = priceRows.slice(i, i + chunkSize)
    const { error } = await supabase.from("prices_raw").upsert(chunk)
    if (error) throw error
  }

  console.log(`[migrate-poke] Copied ${priceRows.length} tcggo raw prices into prices_raw`)
}

main().catch((error) => {
  console.error("[migrate-poke] failed:", error)
  process.exit(1)
})
