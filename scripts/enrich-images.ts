/**
 * Re-fetch high-res artwork for discovered cards already in Supabase.
 *
 * Usage:
 *   npm run enrich-images
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { enrichEntryImages } from "../lib/card-images"
import { normalizeCardEntry, type MockCardEntry } from "../lib/slab-data"

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
    console.error("Set Supabase env vars in .env.local")
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from("slab_watchlist_cards")
    .select(
      `
      id,
      market_insight,
      slab_cards (
        name,
        set_name,
        card_number,
        image_large
      )
    `,
    )
    .like("id", "pc-%")

  if (error) {
    console.error(error.message)
    process.exit(1)
  }

  const entries: MockCardEntry[] = (data ?? [])
    .filter((row) => row.slab_cards)
    .map((row) => {
      const card = row.slab_cards!
      return normalizeCardEntry({
        id: row.id,
        cardName: card.name,
        setName: card.set_name,
        cardNumber: card.card_number,
        imageUrl: card.image_large ?? "https://placehold.co/150x210",
        rawPrice: 0,
        slabGrade: 9,
        slabPrice: 0,
        deficit: 0,
        percentageSavings: 0,
        marketInsight: row.market_insight,
        hasPricing: true,
      })
    })

  console.log(`[enrich-images] ${entries.length} discovered cards (re-validating all photos)`)
  const { entries: updated, resolved } = await enrichEntryImages(
    entries,
    (done, total) => {
      if (done % 25 === 0 || done === total) console.log(`[enrich-images] ${done}/${total}`)
    },
    { forceRefresh: true },
  )

  let saved = 0
  for (const entry of updated) {
    const { error: updateError } = await supabase
      .from("slab_cards")
      .update({ image_large: entry.imageUrl, updated_at: new Date().toISOString() })
      .eq("id", entry.id)

    if (!updateError) saved += 1
  }

  console.log(`[enrich-images] Resolved ${resolved} images, updated ${saved} rows`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
