/**
 * Build catalog_id_legacy_map entries for poke-* → pokemon-* ids.
 * Paginates through ALL poke-* rows by default. Ensures catalog_cards exist first (FK-safe).
 * Optionally copies card_prices raw values into prices_raw when Scrydex prices are absent.
 *
 * Usage:
 *   npx tsx scripts/migrate-poke-to-pokemon-ids.ts           # dry-run
 *   npx tsx scripts/migrate-poke-to-pokemon-ids.ts --apply
 *   npx tsx scripts/migrate-poke-to-pokemon-ids.ts --apply --copy-prices
 *   npx tsx scripts/migrate-poke-to-pokemon-ids.ts --apply --copy-prices --limit=500
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
import {
  cardToCatalogRow,
  copyTcggoPricesForLegacyIds,
  countPokeCards,
  iteratePokeCardPages,
  parseOptionalLimit,
  toLegacyMapRows,
  upsertCatalogRows,
  upsertLegacyMapRows,
  type LegacyCardRow,
} from "@/scripts/scrydex-catalog-seed-shared"

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

async function main() {
  await loadEnvFile(".env")
  await loadEnvFile(".env.local", true)

  const argv = process.argv.slice(2)
  const apply = argv.includes("--apply")
  const copyPrices = argv.includes("--copy-prices")
  const limit = parseOptionalLimit(argv)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const totalAvailable = await countPokeCards(supabase)
  const targetCount = limit == null ? totalAvailable : Math.min(limit, totalAvailable)

  console.log(
    `[migrate-poke] Found ${totalAvailable} poke-* cards in public.cards` +
      (limit == null ? " (processing all)" : ` (processing first ${targetCount} via --limit)`),
  )
  console.log(`[migrate-poke] Mode: ${apply ? "APPLY" : "DRY-RUN"} copy-prices=${copyPrices}`)

  let scanned = 0
  let pricesCopied = 0
  let samplePrinted = false

  for await (const page of iteratePokeCardPages(supabase, limit)) {
    const catalogRows = (page as LegacyCardRow[])
      .map(cardToCatalogRow)
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
    const mappings = toLegacyMapRows(catalogRows)
    scanned += mappings.length

    if (!apply) {
      if (!samplePrinted) {
        for (const row of mappings.slice(0, 5)) {
          console.log(`  ${row.legacy_id} → ${row.catalog_id}`)
        }
        samplePrinted = true
      }
      continue
    }

    await upsertCatalogRows(supabase, catalogRows, "migrate-poke")
    await upsertLegacyMapRows(supabase, mappings, "migrate-poke")

    if (copyPrices) {
      pricesCopied += await copyTcggoPricesForLegacyIds(
        supabase,
        mappings.map((row) => row.legacy_id),
      )
    }

    console.log(`[migrate-poke] Progress: ${scanned}/${targetCount}`)
  }

  if (!apply) {
    console.log(`[migrate-poke] Dry-run complete — would upsert ${scanned} legacy mappings`)
    return
  }

  console.log(`[migrate-poke] Done — upserted ${scanned} catalog_cards + legacy map rows`)
  if (copyPrices) {
    console.log(`[migrate-poke] Copied ${pricesCopied} tcggo raw prices into prices_raw`)
  }
}

main().catch((error) => {
  console.error("[migrate-poke] failed:", error)
  process.exit(1)
})
