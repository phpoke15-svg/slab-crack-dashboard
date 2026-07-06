/**
 * Seed the Supabase card catalog from lib/watchlist-config.json
 * using the official Pokémon TCG API for names, sets, rarity, and images.
 *
 * Prerequisites:
 *   1. Run supabase/schema.sql in your Supabase SQL editor
 *   2. Set env vars (copy .env.example → .env.local)
 *
 * Usage:
 *   node scripts/seed-catalog.mjs
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

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
    /* .env.local optional if vars already exported */
  }
}

function stripRarity(name) {
  return name.replace(/\s+\([^)]+\)/, "").trim()
}

function cardNumberPrefix(cardNumber) {
  return cardNumber.split("/")[0]?.trim() ?? cardNumber
}

function escapeLucene(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function buildQueries(entry) {
  const name = escapeLucene(stripRarity(entry.cardName))
  const number = cardNumberPrefix(entry.cardNumber)
  const setHint = entry.setName
    .replace(/^Scarlet & Violet:\s*/i, "")
    .replace(/^Sword & Shield:\s*/i, "")
    .trim()

  const queries = []
  if (entry.pokemonTcgId) queries.push(`id:${entry.pokemonTcgId}`)
  if (setHint) {
    queries.push(`name:"${name}" number:${number} set.name:"${escapeLucene(setHint)}"`)
    const token = setHint.split(/\s+/).find((w) => w.length > 2) ?? setHint
    if (token !== setHint) queries.push(`name:"${name}" number:${number} set.name:${token}`)
  }
  queries.push(`name:"${name}" number:${number}`)
  return [...new Set(queries)]
}

async function fetchPokemonCardById(id) {
  const headers = { Accept: "application/json" }
  if (process.env.POKEMON_TCG_API_KEY) {
    headers["X-Api-Key"] = process.env.POKEMON_TCG_API_KEY
  }
  const res = await fetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(id)}`, { headers })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Pokémon TCG API HTTP ${res.status}`)
  const payload = await res.json()
  return payload.data ?? null
}

async function fetchPokemonCard(query) {
  const url = new URL("https://api.pokemontcg.io/v2/cards")
  url.searchParams.set("q", query)
  url.searchParams.set("pageSize", "1")

  const headers = { Accept: "application/json" }
  if (process.env.POKEMON_TCG_API_KEY) {
    headers["X-Api-Key"] = process.env.POKEMON_TCG_API_KEY
  }

  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Pokémon TCG API HTTP ${res.status}`)
  const payload = await res.json()
  return payload.data?.[0] ?? null
}

async function main() {
  await loadEnvLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  const missing = []
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL")
  if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY")

  if (missing.length > 0) {
    console.error("\nMissing Supabase credentials.\n")
    console.error("1. Copy .env.example → .env.local in the project root")
    console.error("2. Fill in these values from Supabase → Settings → API:")
    for (const name of missing) console.error(`   - ${name}`)
    console.error("\nAlso run: npm install\n")
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const watchlist = JSON.parse(
    await readFile(join(root, "lib/watchlist-config.json"), "utf-8"),
  )

  for (const entry of watchlist) {
    let catalog = null

    if (entry.pokemonTcgId) {
      console.log(`[seed] Looking up id: ${entry.pokemonTcgId}`)
      try {
        catalog = await fetchPokemonCardById(entry.pokemonTcgId)
      } catch (err) {
        console.error(`[seed] ID lookup failed for ${entry.id}:`, err.message)
      }
      await new Promise((r) => setTimeout(r, 200))
    }

    for (const query of buildQueries(entry)) {
      if (catalog) break
      console.log(`[seed] Looking up: ${query}`)
      try {
        catalog = await fetchPokemonCard(query)
        if (catalog) break
      } catch (err) {
        console.error(`[seed] Query failed for ${entry.id}:`, err.message)
      }
      await new Promise((r) => setTimeout(r, 200))
    }

    if (catalog) {
      const { error: cardError } = await supabase.from("slab_cards").upsert({
        id: catalog.id,
        name: catalog.name,
        set_name: catalog.set?.name ?? entry.setName,
        card_number: catalog.number ?? entry.cardNumber,
        rarity: catalog.rarity ?? null,
        image_small: catalog.images?.small ?? null,
        image_large: catalog.images?.large ?? null,
        updated_at: new Date().toISOString(),
      })
      if (cardError) throw new Error(cardError.message)

      const { error: watchError } = await supabase.from("slab_watchlist_cards").upsert({
        id: entry.id,
        card_id: catalog.id,
        pricecharting_id: entry.priceChartingId || null,
        search_query: entry.searchQuery ?? null,
        ebay_queries: entry.ebayQueries ?? null,
        market_insight: entry.marketInsight,
      })
      if (watchError) throw new Error(watchError.message)

      console.log(`[seed] ✓ ${entry.id} → ${catalog.name} (${catalog.id})`)
      console.log(`       image: ${catalog.images?.large ?? "none"}`)
    } else {
      await supabase.from("slab_watchlist_cards").upsert({
        id: entry.id,
        card_id: null,
        pricecharting_id: entry.priceChartingId || null,
        search_query: entry.searchQuery ?? null,
        ebay_queries: entry.ebayQueries ?? null,
        market_insight: entry.marketInsight,
      })
      console.warn(`[seed] ✗ ${entry.id} — no Pokémon TCG match`)
    }

    await new Promise((r) => setTimeout(r, 350))
  }

  console.log("\nDone. Run npm run sync-prices to populate arbitrage data.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
