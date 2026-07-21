/**
 * Safe pc-* → poke-* re-key migration with backup mapping table.
 *
 * Usage:
 *   npm run migrate-pc-to-poke-ids              # dry-run (default)
 *   npm run migrate-pc-to-poke-ids:apply        # write changes
 *   npx tsx scripts/migrate-pc-to-poke-ids.ts --apply
 *   npx tsx scripts/migrate-pc-to-poke-ids.ts --limit 50
 *
 * Prerequisites:
 *   1. Run supabase/pokemon-api-migration.sql in Supabase SQL Editor
 *   2. Set in .env.local (project root):
 *        NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=eyJ...   (service role, NOT anon key)
 *        RAPIDAPI_POKEMON_TCG_KEY=...
 */

import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

type CliOptions = {
  apply: boolean
  limit: number
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

async function loadEnv() {
  await loadEnvFile(".env")
  await loadEnvFile(".env.local", true)
}

function parseCli(argv: string[]): CliOptions {
  const apply = argv.includes("--apply")
  const limitArg = argv.find((arg) => arg.startsWith("--limit="))
  const limitFlagIdx = argv.indexOf("--limit")
  const limitRaw =
    limitArg?.split("=")[1] ??
    (limitFlagIdx >= 0 ? argv[limitFlagIdx + 1] : undefined) ??
    "100"
  const limit = Math.min(Math.max(Number(limitRaw) || 100, 1), 500)
  return { apply, limit }
}

function requireEnv(): { supabaseUrl: string; serviceRoleKey: string; rapidApiKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""
  const rapidApiKey = process.env.RAPIDAPI_POKEMON_TCG_KEY?.trim() ?? ""

  const missing: string[] = []
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL")
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY")
  if (!rapidApiKey) missing.push("RAPIDAPI_POKEMON_TCG_KEY")

  if (missing.length > 0) {
    throw new Error(
      `Missing required env in .env.local (project root):\n` +
        missing.map((key) => `  - ${key}`).join("\n") +
        `\n\nTips:\n` +
        `  - SUPABASE_SERVICE_ROLE_KEY must be the service role secret (Settings → API), not the anon key.\n` +
        `  - Run this from the repo root: cd /path/to/slab-crack-dashboard\n` +
        `  - Apply mode: npm run migrate-pc-to-poke-ids:apply`,
    )
  }

  return { supabaseUrl, serviceRoleKey, rapidApiKey }
}

async function assertMigrationTablesReady() {
  const { createAdminClient } = await import("../lib/supabase/server")
  const supabase = createAdminClient()

  const { error } = await supabase.from("card_id_legacy_map").select("legacy_pc_id").limit(1)
  if (error?.code === "42P01") {
    throw new Error(
      "Table public.card_id_legacy_map does not exist.\n" +
        "Run supabase/pokemon-api-migration.sql in the Supabase SQL Editor first.",
    )
  }
  if (error) throw new Error(`Supabase preflight failed: ${error.message}`)
}

type LegacyRow = {
  legacyPcId: string
  cardName?: string
  cardSet?: string
  cardNumber?: string
}

async function collectLegacyPcIds(): Promise<LegacyRow[]> {
  const { createAdminClient } = await import("../lib/supabase/server")
  const supabase = createAdminClient()
  const byLegacy = new Map<string, LegacyRow>()

  const add = (legacyPcId: string, meta?: { cardName?: string; cardSet?: string; cardNumber?: string }) => {
    const key = legacyPcId.trim()
    if (!key) return
    const existing = byLegacy.get(key)
    byLegacy.set(key, {
      legacyPcId: key,
      cardName: meta?.cardName ?? existing?.cardName,
      cardSet: meta?.cardSet ?? existing?.cardSet,
      cardNumber: meta?.cardNumber ?? existing?.cardNumber,
    })
  }

  for (const table of ["card_prices", "binder_card_prices"] as const) {
    const { data, error } = await supabase
      .from(table)
      .select("card_id, card_name, card_set, card_number")
      .like("card_id", "pc-%")
      .limit(5000)
    if (error?.code === "42P01") continue
    if (error) throw new Error(`${table} scan failed: ${error.message}`)
    for (const row of data ?? []) {
      add(String(row.card_id).replace(/^pc-/, ""), {
        cardName: row.card_name ?? undefined,
        cardSet: row.card_set ?? undefined,
        cardNumber: row.card_number ?? undefined,
      })
    }
  }

  const { data: binders, error: binderError } = await supabase
    .from("user_binders")
    .select("card_id, card_name, card_set, card_number, legacy_pc_id")
    .or("card_id.like.pc-*,legacy_pc_id.not.is.null")
    .limit(5000)
  if (binderError?.code !== "42P01") {
    if (binderError) throw new Error(`user_binders scan failed: ${binderError.message}`)
    for (const row of binders ?? []) {
      const legacy =
        (row.legacy_pc_id as string | null) ??
        (String(row.card_id).startsWith("pc-") ? String(row.card_id).replace(/^pc-/, "") : null)
      if (legacy) {
        add(legacy, {
          cardName: row.card_name ?? undefined,
          cardSet: row.card_set ?? undefined,
          cardNumber: row.card_number ?? undefined,
        })
      }
    }
  }

  const { data: mapRows, error: mapError } = await supabase
    .from("card_id_legacy_map")
    .select("legacy_pc_id, card_name, card_set, card_number")
    .limit(5000)
  if (!mapError) {
    for (const row of mapRows ?? []) {
      add(String(row.legacy_pc_id), {
        cardName: row.card_name ?? undefined,
        cardSet: row.card_set ?? undefined,
        cardNumber: row.card_number ?? undefined,
      })
    }
  }

  return [...byLegacy.values()]
}

async function applyRekey(resolution: {
  legacyPcId: string
  newPokeId: string
  tcgGoId?: number
  tcgplayerId?: number
  tcgId: string
  language: string
}): Promise<void> {
  const { createAdminClient } = await import("../lib/supabase/server")
  const supabase = createAdminClient()
  const legacyCardId = `pc-${resolution.legacyPcId}`
  const newId = resolution.newPokeId

  const { data: oldPrice } = await supabase.from("card_prices").select("*").eq("card_id", legacyCardId).maybeSingle()
  if (oldPrice) {
    const { data: existingNew } = await supabase.from("card_prices").select("*").eq("card_id", newId).maybeSingle()
    const merged: Record<string, unknown> = {
      ...oldPrice,
      ...existingNew,
      card_id: newId,
      tcggo_id: resolution.tcgGoId ?? oldPrice.tcggo_id ?? existingNew?.tcggo_id ?? null,
      tcgplayer_id: resolution.tcgplayerId ?? oldPrice.tcgplayer_id ?? existingNew?.tcgplayer_id ?? null,
      tcg_id: resolution.tcgId,
      language: resolution.language,
      legacy_pricecharting_id: resolution.legacyPcId,
      price_source: oldPrice.price_source === "pricecharting" ? "tcggo" : oldPrice.price_source,
    }
    delete merged.id
    const { error: upsertError } = await supabase.from("card_prices").upsert(merged, { onConflict: "card_id" })
    if (upsertError) throw new Error(`card_prices upsert failed for ${legacyCardId}: ${upsertError.message}`)
    await supabase.from("card_prices").delete().eq("card_id", legacyCardId)
  }

  await supabase.from("price_history").update({ card_id: newId }).eq("card_id", legacyCardId)

  const { data: oldBinderPrice } = await supabase
    .from("binder_card_prices")
    .select("*")
    .eq("card_id", legacyCardId)
    .maybeSingle()
  if (oldBinderPrice) {
    const { error: binderUpsertError } = await supabase.from("binder_card_prices").upsert(
      {
        ...oldBinderPrice,
        card_id: newId,
        legacy_pc_id: resolution.legacyPcId,
        tcg_id: resolution.tcgId,
        language: resolution.language,
      },
      { onConflict: "card_id" },
    )
    if (binderUpsertError) {
      throw new Error(`binder_card_prices upsert failed for ${legacyCardId}: ${binderUpsertError.message}`)
    }
    await supabase.from("binder_card_prices").delete().eq("card_id", legacyCardId)
  }

  const { data: binderRows } = await supabase
    .from("user_binders")
    .select("id, user_id, card_id")
    .eq("card_id", legacyCardId)

  for (const row of binderRows ?? []) {
    const userId = row.user_id as string
    const { data: conflict } = await supabase
      .from("user_binders")
      .select("id")
      .eq("user_id", userId)
      .eq("card_id", newId)
      .maybeSingle()

    if (conflict?.id) {
      await supabase.from("user_binders").delete().eq("id", row.id)
    } else {
      const { error: updateError } = await supabase
        .from("user_binders")
        .update({
          card_id: newId,
          legacy_pc_id: resolution.legacyPcId,
          pokemon_api_tcg_id: resolution.tcgId,
        })
        .eq("id", row.id)
      if (updateError) {
        throw new Error(`user_binders update failed for ${legacyCardId}: ${updateError.message}`)
      }
    }
  }
}

async function main() {
  await loadEnv()
  const opts = parseCli(process.argv.slice(2))

  console.log(`[migrate-pc-to-poke] cwd=${process.cwd()}`)
  requireEnv()
  await assertMigrationTablesReady()

  const { upsertLegacyMapSeed, listPendingLegacyMaps } = await import("../lib/pricing/card-id-legacy-map")
  const { resolveLegacyPcCardId } = await import("../lib/pricing/resolve-legacy-pc-id")

  const discovered = await collectLegacyPcIds()
  console.log(`[migrate-pc-to-poke] discovered ${discovered.length} legacy pc ids`)

  if (discovered.length === 0) {
    console.log("[migrate-pc-to-poke] Nothing to migrate — no pc-* ids found in card_prices, binders, or mapping table.")
    return
  }

  await upsertLegacyMapSeed(
    discovered.map((row) => ({
      legacyPcId: row.legacyPcId,
      cardName: row.cardName,
      cardSet: row.cardSet,
      cardNumber: row.cardNumber,
    })),
  )

  const pending = await listPendingLegacyMaps(opts.limit)
  console.log(`[migrate-pc-to-poke] resolving up to ${pending.length} pending rows (limit ${opts.limit})`)

  let resolved = 0
  let failed = 0
  let applied = 0

  for (const row of pending) {
    try {
      const result = await resolveLegacyPcCardId({
        legacyCardId: `pc-${row.legacy_pc_id}`,
        cardName: row.card_name,
        cardSet: row.card_set,
        cardNumber: row.card_number,
      })

      if (!result.ok) {
        failed += 1
        console.warn(`  ✗ pc-${row.legacy_pc_id}: ${result.error}`)
        continue
      }

      resolved += 1
      const { resolution } = result
      console.log(
        `  ✓ pc-${resolution.legacyPcId} → ${resolution.newPokeId} (${resolution.tcgId})${result.cached ? " [cached]" : ""}`,
      )

      if (opts.apply) {
        await applyRekey({
          legacyPcId: resolution.legacyPcId,
          newPokeId: resolution.newPokeId,
          tcgGoId: resolution.tcgGoId,
          tcgplayerId: resolution.tcgplayerId,
          tcgId: resolution.tcgId,
          language: resolution.language,
        })
        applied += 1
      }
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`  ✗ pc-${row.legacy_pc_id}: ${message}`)
    }
  }

  console.log(
    `[migrate-pc-to-poke] resolved=${resolved} failed=${failed} applied=${applied} mode=${opts.apply ? "APPLY" : "DRY-RUN"}`,
  )

  if (!opts.apply) {
    console.log("Re-run with: npm run migrate-pc-to-poke-ids:apply")
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
