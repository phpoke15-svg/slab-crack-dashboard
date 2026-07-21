/**
 * Build catalog_id_legacy_map entries for poke-* → pokemon-* ids.
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
    .select("id")
    .like("id", "poke-%")
    .limit(limit)

  if (cardsError) throw cardsError

  const mappings = ((cards ?? []) as { id: string }[])
    .map((row) => {
      const catalogId = legacyPokeIdToCatalogId(row.id)
      if (!catalogId) return null
      return { legacy_id: row.id, catalog_id: catalogId, legacy_source: "poke-tcggo" }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  console.log(`[migrate-poke] ${mappings.length} legacy mappings (limit ${limit})`)
  console.log(`[migrate-poke] Mode: ${apply ? "APPLY" : "DRY-RUN"} copy-prices=${copyPrices}`)

  if (!apply) {
    for (const row of mappings.slice(0, 5)) {
      console.log(`  ${row.legacy_id} → ${row.catalog_id}`)
    }
    return
  }

  const chunkSize = 100
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
