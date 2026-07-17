/**
 * Backfill set_slug and card_slug for existing catalog rows.
 *
 * Usage:
 *   npx tsx scripts/backfill-card-slugs.ts
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { buildCardSlug, buildSetSlug } from "../lib/seo/card-slugs"

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

async function main() {
  await loadEnvLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const supabase = createClient(url, key)
  let from = 0
  let updated = 0

  while (true) {
    const { data, error } = await supabase
      .from("cards")
      .select("id, name, set_name, set_id, number")
      .order("id")
      .range(from, from + 499)

    if (error) throw error
    if (!data?.length) break

    for (const row of data) {
      const set_slug = buildSetSlug(row.set_id, row.set_name)
      const card_slug = buildCardSlug(row.name, row.number ?? "")
      const { error: updateError } = await supabase
        .from("cards")
        .update({ set_slug, card_slug })
        .eq("id", row.id)
      if (updateError) throw updateError
      updated += 1
    }

    from += data.length
    console.log(`[backfill-card-slugs] updated ${updated}`)
  }

  console.log(`[backfill-card-slugs] done — ${updated} rows`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
