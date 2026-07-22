/**
 * Inspect Scrydex price history JSON for a card (requires SCRYDEX_API_KEY + SCRYDEX_TEAM_ID).
 *
 * Usage:
 *   node scripts/inspect-scrydex-price-history.mjs base1-4
 *   node scripts/inspect-scrydex-price-history.mjs base1-4 --duration=30d
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8")
    for (const line of text.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "")
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // optional
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"))
loadEnvFile(resolve(process.cwd(), ".env.vercel"))

const scrydexId = process.argv[2] ?? "base1-4"
const durationArg = process.argv.find((arg) => arg.startsWith("--duration="))
const duration = durationArg?.split("=")[1] ?? "30d"

const apiKey = process.env.SCRYDEX_API_KEY?.trim()
const teamId = process.env.SCRYDEX_TEAM_ID?.trim()

if (!apiKey || !teamId) {
  console.error("Missing SCRYDEX_API_KEY or SCRYDEX_TEAM_ID. Set them in .env.local or .env.vercel.")
  process.exit(1)
}

const headers = {
  "X-Api-Key": apiKey,
  "X-Team-ID": teamId,
  Accept: "application/json",
}

async function fetchJson(url) {
  const res = await fetch(url, { headers })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(json)?.slice(0, 500)}`)
  }
  return json
}

const cardUrl = `https://api.scrydex.com/pokemon/v1/cards/${encodeURIComponent(scrydexId)}?include=prices&casing=snake`
const historyUrl = `https://api.scrydex.com/pokemon/v1/cards/${encodeURIComponent(scrydexId)}/price_history?priceHistoryDuration=${duration}&page=1&page_size=5&casing=snake`

console.log(`\n=== Scrydex card snapshot (${scrydexId}) ===`)
const card = await fetchJson(cardUrl)
const variants = card?.data?.variants ?? []
console.log("variant names:", variants.map((v) => v.name))
for (const variant of variants.slice(0, 3)) {
  const prices = (variant.prices ?? []).slice(0, 6)
  console.log(`\nvariant ${variant.name} sample prices:`)
  for (const price of prices) {
    console.log(
      JSON.stringify({
        type: price.type,
        condition: price.condition,
        company: price.company,
        grade: price.grade,
        market: price.market,
        low: price.low,
        mid: price.mid,
      }),
    )
  }
}

console.log(`\n=== Scrydex price history (${scrydexId}, ${duration}) ===`)
const history = await fetchJson(historyUrl)
const days = history?.data ?? []
console.log("total_count:", history?.total_count ?? history?.totalCount)
console.log("days returned:", days.length)

for (const day of days.slice(0, 3)) {
  console.log(`\ndate: ${day.date}`)
  const prices = day.prices ?? (day.market != null ? [day] : [])
  for (const price of prices.slice(0, 8)) {
    console.log(
      JSON.stringify({
        variant: price.variant,
        type: price.type,
        condition: price.condition,
        company: price.company,
        grade: price.grade,
        market: price.market,
        low: price.low,
      }),
    )
  }
  if (prices.length > 8) console.log(`... +${prices.length - 8} more price rows`)
}

console.log("\nField mapping used by our pipeline:")
console.log("- date -> snapshot_date / recorded_at")
console.log("- prices[].market -> market_price")
console.log("- prices[].type raw|graded, company+grade for PSA slabs")
console.log("- prices[].variant -> variant (prefer normal, then holo/foil)")
