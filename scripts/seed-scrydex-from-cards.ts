/**
 * Seed catalog_cards + catalog_id_legacy_map from the existing public.cards table.
 * Paginates through ALL poke-* rows by default. No Scrydex API credits required.
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
import {
  cardToCatalogRow,
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
    `[seed-scrydex] Found ${totalAvailable} poke-* cards in public.cards` +
      (limit == null ? " (processing all)" : ` (processing first ${targetCount} via --limit)`),
  )
  console.log(`[seed-scrydex] Mode: ${apply ? "APPLY" : "DRY-RUN"}`)

  let scanned = 0
  let samplePrinted = false

  for await (const page of iteratePokeCardPages(supabase, limit)) {
    const catalogRows = (page as LegacyCardRow[])
      .map(cardToCatalogRow)
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
    const legacyRows = toLegacyMapRows(catalogRows)
    scanned += catalogRows.length

    if (!apply) {
      if (!samplePrinted) {
        console.log("[seed-scrydex] Sample rows:")
        for (const row of catalogRows.slice(0, 5)) {
          console.log(`  ${row.metadata.legacy_id} → ${row.catalog_id} (${row.name})`)
        }
        samplePrinted = true
      }
      continue
    }

    await upsertCatalogRows(supabase, catalogRows, "seed-scrydex")
    await upsertLegacyMapRows(supabase, legacyRows, "seed-scrydex")
    console.log(`[seed-scrydex] Progress: ${scanned}/${targetCount}`)
  }

  if (apply) {
    console.log(`[seed-scrydex] Done — upserted ${scanned} catalog_cards + legacy map rows`)
  } else {
    console.log(`[seed-scrydex] Dry-run complete — would upsert ${scanned} rows`)
  }
}

main().catch((error) => {
  console.error("[seed-scrydex] failed:", error)
  process.exit(1)
})
