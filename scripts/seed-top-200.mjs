/**
 * Seed the top 200 chase-tier Pokémon cards into Supabase.
 *
 * Usage:
 *   npm run seed-top-200
 *
 * Fetches high-rarity cards from the Pokémon TCG API (newest sets first),
 * then upserts into slab_cards + slab_watchlist_cards.
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const LIMIT = Number(process.env.TOP_CARDS_LIMIT ?? 200)

const CHASE_RARITIES = [
  "Special Illustration Rare",
  "Hyper Rare",
  "Secret Rare",
  "Illustration Rare",
  "Ultra Rare",
  "Rare Rainbow",
  "Amazing Rare",
  "ACE SPEC Rare",
  "Double Rare",
  "Rare Holo VMAX",
  "Rare Holo V",
  "Rare Holo",
]

const DEFAULT_INSIGHT =
  "Chase-tier card tracked for slab vs raw arbitrage. Run sync-prices to refresh eBay sold comps."

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

function buildChaseQuery() {
  return `(${CHASE_RARITIES.map((r) => `rarity:"${r}"`).join(" OR ")})`
}

function buildEbayQueries(name, setName, cardNumber) {
  const num = cardNumber.split("/")[0]?.trim() ?? cardNumber
  const setShort = setName.replace(/^(Scarlet & Violet|Sword & Shield):\s*/i, "").trim()
  const base = `${name} ${num} ${setShort} pokemon`.replace(/\s+/g, " ").trim()
  return {
    raw: `${base} NM`,
    psa7: `${base} PSA 7`,
    psa8: `${base} PSA 8`,
    psa9: `${base} PSA 9`,
  }
}

function buildSearchQuery(name, setName, cardNumber) {
  const num = cardNumber.split("/")[0]?.trim() ?? cardNumber
  const setShort = setName.replace(/^(Scarlet & Violet|Sword & Shield):\s*/i, "").trim()
  const cleanName = name.replace(/\s+\([^)]+\)/, "").trim().toLowerCase()
  return `${cleanName} #${num} ${setShort.toLowerCase()}`
}

async function fetchChaseCardsPage(page, pageSize) {
  const url = new URL("https://api.pokemontcg.io/v2/cards")
  url.searchParams.set("q", buildChaseQuery())
  url.searchParams.set("orderBy", "-set.releaseDate")
  url.searchParams.set("page", String(page))
  url.searchParams.set("pageSize", String(pageSize))

  const headers = { Accept: "application/json" }
  if (process.env.POKEMON_TCG_API_KEY) {
    headers["X-Api-Key"] = process.env.POKEMON_TCG_API_KEY
  }

  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Pokémon TCG API HTTP ${res.status} on page ${page}`)
  return res.json()
}

async function collectTopCards(limit) {
  const seen = new Set()
  const cards = []
  let page = 1
  const pageSize = 250

  while (cards.length < limit && page <= 10) {
    console.log(`[top-200] Fetching page ${page}...`)
    const payload = await fetchChaseCardsPage(page, pageSize)
    const batch = payload.data ?? []

    if (batch.length === 0) break

    for (const card of batch) {
      if (seen.has(card.id)) continue
      seen.add(card.id)
      cards.push(card)
      if (cards.length >= limit) break
    }

    page += 1
    await new Promise((r) => setTimeout(r, 350))
  }

  return cards.slice(0, limit)
}

async function main() {
  await loadEnvLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(`[top-200] Collecting up to ${LIMIT} chase-tier cards...`)
  const cards = await collectTopCards(LIMIT)
  console.log(`[top-200] Found ${cards.length} cards. Upserting to Supabase...`)

  let ok = 0
  for (const card of cards) {
    const setName = card.set?.name ?? "Unknown Set"
    const cardNumber = card.number ?? ""

    const { error: cardError } = await supabase.from("slab_cards").upsert({
      id: card.id,
      name: card.name,
      set_name: setName,
      card_number: cardNumber,
      rarity: card.rarity ?? null,
      image_small: card.images?.small ?? null,
      image_large: card.images?.large ?? null,
      updated_at: new Date().toISOString(),
    })
    if (cardError) {
      console.error(`[top-200] ✗ ${card.id}: ${cardError.message}`)
      continue
    }

    const { error: watchError } = await supabase.from("slab_watchlist_cards").upsert({
      id: card.id,
      card_id: card.id,
      pricecharting_id: null,
      search_query: buildSearchQuery(card.name, setName, cardNumber),
      ebay_queries: buildEbayQueries(card.name, setName, cardNumber),
      market_insight: DEFAULT_INSIGHT,
    })
    if (watchError) {
      console.error(`[top-200] ✗ watchlist ${card.id}: ${watchError.message}`)
      continue
    }

    ok += 1
    if (ok % 25 === 0) console.log(`[top-200] … ${ok}/${cards.length}`)
  }

  console.log(`\n[top-200] Done. Seeded ${ok} cards.`)
  console.log("[top-200] Next: npm run sync-prices  (warning: ~4 API calls per card)")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
