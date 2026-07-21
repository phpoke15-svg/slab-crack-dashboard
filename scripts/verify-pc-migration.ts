/**
 * Verify pc-* → poke-* migration status.
 *
 * Usage (from repo root):
 *   npm run verify-pc-migration
 */

import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

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
    if (override || !process.env[key]?.trim()) process.env[key] = value
  }
}

async function main() {
  await loadEnvFile(".env")
  await loadEnvFile(".env.local", true)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }

  const { createAdminClient } = await import("../lib/supabase/server")
  const supabase = createAdminClient()

  console.log("\n=== PC → Poke migration status ===\n")

  const checks: Array<{ label: string; ok: boolean; detail: string }> = []

  const { data: mapStats, error: mapError } = await supabase
    .from("card_id_legacy_map")
    .select("resolution_status")

  if (mapError?.code === "42P01") {
    console.error("❌ card_id_legacy_map table missing — run supabase/pokemon-api-migration.sql")
    process.exit(1)
  }
  if (mapError) throw mapError

  const byStatus = new Map<string, number>()
  for (const row of mapStats ?? []) {
    const s = String(row.resolution_status)
    byStatus.set(s, (byStatus.get(s) ?? 0) + 1)
  }

  console.log("Mapping table (card_id_legacy_map):")
  if (byStatus.size === 0) {
    console.log("  (empty — no legacy pc ids found or SQL seed did not run)")
  } else {
    for (const [status, count] of [...byStatus.entries()].sort()) {
      console.log(`  ${status}: ${count}`)
    }
  }

  const { count: pcPrices } = await supabase
    .from("card_prices")
    .select("*", { count: "exact", head: true })
    .like("card_id", "pc-%")

  const { count: pokePrices } = await supabase
    .from("card_prices")
    .select("*", { count: "exact", head: true })
    .like("card_id", "poke-%")

  const { count: legacyTagged } = await supabase
    .from("card_prices")
    .select("*", { count: "exact", head: true })
    .not("legacy_pricecharting_id", "is", null)

  console.log("\nPrice cache (card_prices):")
  console.log(`  pc-* rows remaining:     ${pcPrices ?? 0}`)
  console.log(`  poke-* rows:             ${pokePrices ?? 0}`)
  console.log(`  legacy_pc_id tagged:     ${legacyTagged ?? 0}`)

  const { count: pcBinders } = await supabase
    .from("user_binders")
    .select("*", { count: "exact", head: true })
    .like("card_id", "pc-%")

  const { count: pokeBinders } = await supabase
    .from("user_binders")
    .select("*", { count: "exact", head: true })
    .like("card_id", "poke-%")

  console.log("\nUser binders (user_binders):")
  console.log(`  pc-* card_id remaining:  ${pcBinders ?? 0}`)
  console.log(`  poke-* card_id:          ${pokeBinders ?? 0}`)

  const pending = byStatus.get("pending") ?? 0
  const failed = byStatus.get("failed") ?? 0
  const resolved = byStatus.get("resolved") ?? 0

  if (failed > 0 || pending > 0) {
    const { getLegacyMapErrorSummary } = await import("../lib/pricing/card-id-legacy-map")
    const errors = await getLegacyMapErrorSummary()
    console.log("\nTop issues:")
    for (const [message, count] of [...errors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      console.log(`  ${count}\t${message}`)
    }
  }

  checks.push({
    label: "Mapping table exists",
    ok: !mapError,
    detail: `${mapStats?.length ?? 0} total rows`,
  })
  checks.push({
    label: "All mappings resolved",
    ok: pending === 0 && failed === 0 && resolved > 0,
    detail: `resolved=${resolved} pending=${pending} failed=${failed}`,
  })
  checks.push({
    label: "No pc-* card_prices left",
    ok: (pcPrices ?? 0) === 0,
    detail: `${pcPrices ?? 0} remaining`,
  })
  checks.push({
    label: "No pc-* user_binders left",
    ok: (pcBinders ?? 0) === 0,
    detail: `${pcBinders ?? 0} remaining`,
  })

  const { data: discovery } = await supabase
    .from("discovery_scan_state")
    .select("catalog_page, total_pages, updated_at")
    .eq("job_id", "tcggo_catalog_arbitrage")
    .maybeSingle()

  if (discovery) {
    console.log("\nDiscovery cron cursor:")
    console.log(`  page ${discovery.catalog_page} / ${discovery.total_pages ?? "?"} (updated ${discovery.updated_at})`)
  }

  console.log("\n=== Summary ===")
  for (const c of checks) {
    console.log(`${c.ok ? "✅" : "⚠️ "} ${c.label} — ${c.detail}`)
  }

  const allGood = checks.every((c) => c.ok)
  if (allGood) {
    console.log("\n✅ Migration looks complete.")
  } else if (resolved > 0 && (pcPrices ?? 0) === 0) {
    console.log("\n✅ Mostly complete — some mapping rows may still show pending if apply was dry-run only.")
  } else if (pending > 0 || (pcPrices ?? 0) > 0) {
    console.log("\n⚠️  Migration not finished. Run:")
    console.log("   npm run migrate-pc-to-poke-ids")
    console.log("   npm run migrate-pc-to-poke-ids:apply")
  } else {
    console.log("\nℹ️  No legacy pc-* data found — nothing to migrate (or SQL seed not run).")
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
