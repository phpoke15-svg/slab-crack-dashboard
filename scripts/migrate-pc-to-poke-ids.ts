/**
 * Safe pc-* → poke-* re-key migration with backup mapping table.
 *
 * Usage:
 *   npx tsx scripts/migrate-pc-to-poke-ids.ts            # dry-run (default)
 *   npx tsx scripts/migrate-pc-to-poke-ids.ts --apply    # write changes
 *   npx tsx scripts/migrate-pc-to-poke-ids.ts --limit 50 # batch size
 *
 * Prerequisites:
 *   1. Run supabase/pokemon-api-migration.sql in Supabase SQL Editor
 *   2. Set RAPIDAPI_POKEMON_TCG_KEY + Supabase service role in .env.local
 */

import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

async function loadEnvLocal() {
  try {
    const raw = await readFile(join(root, ".env.local"), "utf-8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    /* optional */
  }
}

type CliOptions = {
  apply: boolean
  limit: number
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

async function collectLegacyPcIds(): Promise<
  Array<{ legacyPcId: string; cardName?: string; cardSet?: string; cardNumber?: string }>
> {
  const { createAdminClient, isSupabaseConfigured } = await import("../lib/supabase/server")
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")

  const supabase = createAdminClient()
  const byLegacy = new Map<
    string,
    { legacyPcId: string; cardName?: string; cardSet?: string; cardNumber?: string }
  >()

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
    if (error && error.code !== "42P01") throw error
    for (const row of data ?? []) {
      const cardId = String(row.card_id)
      add(cardId.replace(/^pc-/, ""), {
        cardName: row.card_name ?? undefined,
        cardSet: row.card_set ?? undefined,
        cardNumber: row.card_number ?? undefined,
      })
    }
  }

  const { data: binders, error: binderError } = await supabase
    .from("user_binders")
    .select("card_id, card_name, card_set, card_number, legacy_pc_id")
    .or("card_id.like.pc-%,legacy_pc_id.not.is.null")
    .limit(5000)
  if (binderError && binderError.code !== "42P01") throw binderError
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
    const merged = {
      ...oldPrice,
      ...existingNew,
      card_id: newId,
      tcggo_id: resolution.tcgGoId ?? oldPrice.tcggo_id ?? existingNew?.tcggo_id,
      tcgplayer_id: resolution.tcgplayerId ?? oldPrice.tcgplayer_id ?? existingNew?.tcgplayer_id,
      tcg_id: resolution.tcgId,
      language: resolution.language,
      legacy_pricecharting_id: resolution.legacyPcId,
      price_source: oldPrice.price_source === "pricecharting" ? "tcggo" : oldPrice.price_source,
    }
    delete (merged as { id?: unknown }).id
    await supabase.from("card_prices").upsert(merged, { onConflict: "card_id" })
    await supabase.from("card_prices").delete().eq("card_id", legacyCardId)
  }

  await supabase
    .from("price_history")
    .update({ card_id: newId })
    .eq("card_id", legacyCardId)

  const { data: oldBinderPrice } = await supabase
    .from("binder_card_prices")
    .select("*")
    .eq("card_id", legacyCardId)
    .maybeSingle()
  if (oldBinderPrice) {
    await supabase.from("binder_card_prices").upsert(
      {
        ...oldBinderPrice,
        card_id: newId,
        legacy_pc_id: resolution.legacyPcId,
        tcg_id: resolution.tcgId,
        language: resolution.language,
      },
      { onConflict: "card_id" },
    )
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
      await supabase
        .from("user_binders")
        .update({
          card_id: newId,
          legacy_pc_id: resolution.legacyPcId,
          pokemon_api_tcg_id: resolution.tcgId,
        })
        .eq("id", row.id)
    }
  }
}

async function main() {
  await loadEnvLocal()
  const opts = parseCli(process.argv.slice(2))

  const { upsertLegacyMapSeed, listPendingLegacyMaps } = await import("../lib/pricing/card-id-legacy-map")
  const { resolveLegacyPcCardId } = await import("../lib/pricing/resolve-legacy-pc-id")

  const discovered = await collectLegacyPcIds()
  console.log(`[migrate-pc-to-poke] discovered ${discovered.length} legacy pc ids`)

  if (discovered.length > 0) {
    await upsertLegacyMapSeed(
      discovered.map((row) => ({
        legacyPcId: row.legacyPcId,
        cardName: row.cardName,
        cardSet: row.cardSet,
        cardNumber: row.cardNumber,
      })),
    )
  }

  const pending = await listPendingLegacyMaps(opts.limit)
  console.log(`[migrate-pc-to-poke] resolving up to ${pending.length} pending rows (limit ${opts.limit})`)

  let resolved = 0
  let failed = 0
  let applied = 0

  for (const row of pending) {
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
  }

  console.log(
    `[migrate-pc-to-poke] resolved=${resolved} failed=${failed} applied=${applied} mode=${opts.apply ? "APPLY" : "DRY-RUN"}`,
  )

  if (!opts.apply) {
    console.log("Re-run with --apply to write re-keyed ids to Supabase.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
