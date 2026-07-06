/**
 * Resolve and store PriceCharting product IDs for every watchlist card.
 *
 * Run once (or after seeding new cards), then sync-prices is faster and more accurate.
 *
 * Usage:
 *   npm run resolve-pricecharting-ids
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const PRODUCT_URL = "https://www.pricecharting.com/api/product"
const PRODUCTS_URL = "https://www.pricecharting.com/api/products"

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

function stripRarity(name) {
  return name.replace(/\s+\([^)]+\)/, "").trim()
}

function cardNumberPrefix(cardNumber) {
  return cardNumber.split("/")[0]?.trim() ?? cardNumber
}

function shortSetName(setName) {
  return setName.replace(/^(Scarlet & Violet|Sword & Shield|Sun & Moon|XY|Black & White):\s*/i, "").trim()
}

function buildQueries(cardName, setName, cardNumber) {
  const name = stripRarity(cardName).toLowerCase()
  const num = cardNumberPrefix(cardNumber)
  const setShort = shortSetName(setName).toLowerCase()
  return [...new Set([
    `${name} #${num} ${setShort}`,
    `${name} #${num} pokemon ${setShort}`,
    `${name} ${setShort} pokemon`,
    `${name} #${num}`,
    `${name} ${setShort}`,
  ])]
}

function scoreMatch(hit, ctx) {
  const productName = (hit["product-name"] ?? "").toLowerCase()
  const consoleName = (hit["console-name"] ?? "").toLowerCase()
  const name = stripRarity(ctx.cardName).toLowerCase()
  const num = cardNumberPrefix(ctx.cardNumber).toLowerCase()
  const setShort = shortSetName(ctx.setName).toLowerCase()
  const setTokens = setShort.split(/\s+/).filter((t) => t.length > 2)

  let score = 0
  if (productName.includes(name) || name.split(" ").every((w) => productName.includes(w))) score += 12
  if (productName.includes(`#${num}`) || productName.includes(` ${num} `)) score += 8
  if (consoleName.includes("pokemon")) score += 4
  for (const token of setTokens) {
    if (consoleName.includes(token) || productName.includes(token)) score += 3
  }
  if (consoleName.includes(setShort) || productName.includes(setShort)) score += 6
  return score
}

async function fetchProducts(apiKey, query) {
  const params = new URLSearchParams({ t: apiKey, q: query })
  const res = await fetch(`${PRODUCTS_URL}?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data.status === "error") return []
  return data.products ?? []
}

async function fetchProduct(apiKey, { id, query }) {
  const params = new URLSearchParams({ t: apiKey })
  if (id) params.set("id", id)
  else params.set("q", query)
  const res = await fetch(`${PRODUCT_URL}?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data.status === "error") throw new Error(data["error-message"] ?? "PriceCharting error")
  return data
}

async function resolveId(apiKey, row) {
  const card = row.slab_cards
  if (!card) return null

  const ctx = {
    cardName: card.name,
    setName: card.set_name,
    cardNumber: card.card_number,
  }

  if (row.pricecharting_id) {
    return { id: row.pricecharting_id, score: 999, query: "existing id" }
  }

  const queries = [
    ...(row.search_query ? [row.search_query] : []),
    ...buildQueries(ctx.cardName, ctx.setName, ctx.cardNumber),
  ]

  let bestId
  let bestScore = 0
  let bestQuery = queries[0]

  for (const query of [...new Set(queries)]) {
    const hits = await fetchProducts(apiKey, query)
    for (const hit of hits) {
      if (!hit.id) continue
      const score = scoreMatch(hit, ctx)
      if (score > bestScore) {
        bestScore = score
        bestId = hit.id
        bestQuery = query
      }
    }
    if (bestScore >= 18) break
    await new Promise((r) => setTimeout(r, 1100))
  }

  if (!bestId || bestScore < 10) return null
  return { id: bestId, score: bestScore, query: bestQuery }
}

async function main() {
  await loadEnvLocal()

  const apiKey = process.env.PRICECHARTING_API_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!apiKey) {
    console.error("Set PRICECHARTING_API_KEY in .env.local")
    process.exit(1)
  }
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")
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
      pricecharting_id,
      search_query,
      slab_cards (
        name,
        set_name,
        card_number
      )
    `,
    )

  if (error) {
    console.error(error.message)
    process.exit(1)
  }

  const rows = data ?? []
  let resolved = 0
  let skipped = 0
  let already = 0

  console.log(`[resolve] ${rows.length} watchlist cards...`)

  for (const row of rows) {
    const card = row.slab_cards
    if (!card) continue

    if (row.pricecharting_id) {
      already += 1
      continue
    }

    try {
      const match = await resolveId(apiKey, row)
      if (!match) {
        console.warn(`[resolve] ✗ ${card.name} — no confident match`)
        skipped += 1
        await new Promise((r) => setTimeout(r, 1100))
        continue
      }

      const product = await fetchProduct(apiKey, { id: match.id })
      const rawCents = Number(product["loose-price"] ?? 0)
      if (rawCents <= 0) {
        console.warn(`[resolve] ✗ ${card.name} — matched id ${match.id} but no raw price`)
        skipped += 1
        await new Promise((r) => setTimeout(r, 1100))
        continue
      }

      const { error: updateError } = await supabase
        .from("slab_watchlist_cards")
        .update({ pricecharting_id: match.id })
        .eq("id", row.id)

      if (updateError) throw updateError

      resolved += 1
      console.log(
        `[resolve] ✓ ${card.name} → id ${match.id} (score ${match.score}, "${match.query}")`,
      )
    } catch (err) {
      skipped += 1
      console.warn(`[resolve] ✗ ${card.name}: ${err.message}`)
    }

    await new Promise((r) => setTimeout(r, 1100))
  }

  console.log(`\n[resolve] Done. ${resolved} new, ${already} already had ids, ${skipped} skipped.`)
  console.log("[resolve] Next: curl http://localhost:3001/api/cron/sync-prices")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
