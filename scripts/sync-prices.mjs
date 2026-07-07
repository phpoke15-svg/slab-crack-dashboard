/**
 * Cron-friendly price sync script.
 *
 * eBay sold comps (default):
 *   PRICE_SOURCE=ebay EBAY_SOLD_API_KEY=sc_xxx node scripts/sync-prices.mjs
 *
 * PriceCharting:
 *   PRICE_SOURCE=pricecharting PRICECHARTING_API_KEY=xxx node scripts/sync-prices.mjs
 */

const PRICE_SOURCE = process.env.PRICE_SOURCE ?? "ebay"

function findBestArbitrage(rawPrice, grades) {
  if (rawPrice <= 0) return null
  let best = null
  for (const { grade, price } of grades) {
    if (price <= 0 || price >= rawPrice) continue
    const deficit = rawPrice - price
    const percentageSavings = Math.round((deficit / rawPrice) * 100)
    if (!best || deficit > best.deficit) {
      best = { slabGrade: grade, slabPrice: price, deficit, percentageSavings }
    }
  }
  return best
}

function median(values) {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

function isGraded(title) {
  return /\b(PSA|BGS|CGC|SGC)\b/i.test(title)
}

function matchesPsa(title, grade) {
  return new RegExp(`\\bPSA\\s*${grade}\\b`, "i").test(title)
}

function medianSold(items, grade) {
  const filtered =
    grade === "raw"
      ? items.filter((i) => !isGraded(i.title))
      : items.filter((i) => matchesPsa(i.title, grade))
  const prices = filtered
    .slice(0, 12)
    .map((i) => parseFloat(i.soldPrice) + parseFloat(i.shippingPrice || 0))
    .filter((p) => p > 0)
  return median(prices)
}

async function fetchEbaySold(apiKey, keyword) {
  const base = process.env.EBAY_SOLD_API_BASE ?? "https://api.sold-comps.com"
  const params = new URLSearchParams({
    keyword,
    sortOrder: "endedRecently",
    daysToScrape: "30",
    count: "240",
    page: "1",
  })
  const res = await fetch(`${base}/v1/scrape?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`eBay sold HTTP ${res.status} for "${keyword}"`)
  return res.json()
}

async function syncEbay(apiKey, watchlist) {
  const anomalies = []
  for (const card of watchlist) {
    const q = card.ebayQueries ?? {
      raw: `${card.searchQuery ?? card.cardName} NM`,
      psa8: `${card.searchQuery ?? card.cardName} PSA 8`,
      psa9: `${card.searchQuery ?? card.cardName} PSA 9`,
    }

    const rawData = await fetchEbaySold(apiKey, q.raw)
    const rawPrice = medianSold(rawData.items ?? [], "raw")
    await new Promise((r) => setTimeout(r, 1100))

    const psa7Data = await fetchEbaySold(apiKey, q.psa7 ?? `${q.raw} PSA 7`)
    const psa8Data = await fetchEbaySold(apiKey, q.psa8 ?? `${q.raw} PSA 8`)
    await new Promise((r) => setTimeout(r, 1100))
    const psa9Data = await fetchEbaySold(apiKey, q.psa9 ?? `${q.raw} PSA 9`)
    await new Promise((r) => setTimeout(r, 1100))
    const psa10Data = await fetchEbaySold(apiKey, q.psa10 ?? `${q.raw} PSA 10`)
    await new Promise((r) => setTimeout(r, 1100))

    const grades = [
      { grade: 7, price: medianSold(psa7Data.items ?? [], 7) },
      { grade: 8, price: medianSold(psa8Data.items ?? [], 8) },
      { grade: 9, price: medianSold(psa9Data.items ?? [], 9) },
      { grade: 10, price: medianSold(psa10Data.items ?? [], 10) },
    ]

    const arbitrage = findBestArbitrage(rawPrice, grades)
    if (arbitrage) {
      console.log(
        `[ALERT] Arbitrage found on ${card.cardName}! PSA ${arbitrage.slabGrade} is $${arbitrage.deficit.toFixed(2)} cheaper than Raw (eBay sold comps).`,
      )
      anomalies.push({
        id: card.id,
        cardName: card.cardName,
        setName: card.setName,
        cardNumber: card.cardNumber,
        imageUrl: card.imageUrl,
        rawPrice,
        slabGrade: arbitrage.slabGrade,
        slabPrice: arbitrage.slabPrice,
        deficit: arbitrage.deficit,
        percentageSavings: arbitrage.percentageSavings,
        marketInsight: `${card.marketInsight} (Prices from eBay sold comps, last 30 days.)`,
      })
    }
  }
  return anomalies
}

async function syncPriceCharting(apiKey, watchlist) {
  const BASE_URL = "https://www.pricecharting.com/api/product"
  const parsePriceCents = (value) => {
    if (value == null || value === "") return 0
    const cents = typeof value === "string" ? parseInt(value, 10) : Number(value)
    return Number.isFinite(cents) && cents > 0 ? cents / 100 : 0
  }

  const anomalies = []
  for (const card of watchlist) {
    const params = new URLSearchParams({ t: apiKey })
    if (card.priceChartingId) params.set("id", card.priceChartingId)
    else params.set("q", card.searchQuery)
    const res = await fetch(`${BASE_URL}?${params}`)
    const data = await res.json()
    const rawPrice = parsePriceCents(data["loose-price"])
    const grades = [
      { grade: 7, price: parsePriceCents(data["cib-price"]) },
      { grade: 8, price: parsePriceCents(data["new-price"]) },
      { grade: 9, price: parsePriceCents(data["graded-price"]) },
      { grade: 10, price: parsePriceCents(data["manual-only-price"]) },
    ]
    const arbitrage = findBestArbitrage(rawPrice, grades)
    if (arbitrage) {
      anomalies.push({
        id: card.id,
        cardName: card.cardName,
        setName: card.setName,
        cardNumber: card.cardNumber,
        imageUrl: card.imageUrl,
        rawPrice,
        slabGrade: arbitrage.slabGrade,
        slabPrice: arbitrage.slabPrice,
        deficit: arbitrage.deficit,
        percentageSavings: arbitrage.percentageSavings,
        marketInsight: card.marketInsight,
      })
    }
    await new Promise((r) => setTimeout(r, 1100))
  }
  return anomalies
}

async function loadEnvLocal(root) {
  try {
    const { readFile } = await import("node:fs/promises")
    const { join } = await import("node:path")
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

async function loadWatchlist(root) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url && key) {
    const { createClient } = await import("@supabase/supabase-js")
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
        market_insight,
        slab_cards (
          name,
          set_name,
          card_number,
          image_large,
          rarity
        )
      `,
      )
    if (error) throw new Error(`Supabase watchlist: ${error.message}`)
    if ((data ?? []).length > 0) {
      return (data ?? [])
        .filter((row) => row.slab_cards)
        .map((row) => {
          const card = row.slab_cards
          const rarity = card.rarity
          const name =
            rarity && !card.name.toLowerCase().includes(rarity.toLowerCase())
              ? `${card.name} (${rarity})`
              : card.name
          return {
            id: row.id,
            priceChartingId: row.pricecharting_id ?? "",
            searchQuery: row.search_query ?? "",
            cardName: name,
            setName: card.set_name,
            cardNumber: card.card_number,
            imageUrl: card.image_large ?? "https://placehold.co/150x210",
            marketInsight: row.market_insight,
          }
        })
    }
  }

  const { readFile } = await import("node:fs/promises")
  const { join } = await import("node:path")
  return JSON.parse(await readFile(join(root, "lib/watchlist-config.json"), "utf-8"))
}

async function main() {
  const { writeFile } = await import("node:fs/promises")
  const { fileURLToPath } = await import("node:url")
  const { dirname, join } = await import("node:path")

  const root = join(dirname(fileURLToPath(import.meta.url)), "..")
  await loadEnvLocal(root)
  const watchlist = await loadWatchlist(root)
  console.log(`[sync-prices] ${watchlist.length} cards from ${process.env.NEXT_PUBLIC_SUPABASE_URL ? "Supabase" : "watchlist-config.json"}`)
  const cachePath = join(root, "data/anomalies-cache.json")

  let anomalies = []
  if (PRICE_SOURCE === "ebay") {
    const key = process.env.EBAY_SOLD_API_KEY
    if (!key) {
      console.error("Set EBAY_SOLD_API_KEY (SoldComps key starting with sc_)")
      process.exit(1)
    }
    anomalies = await syncEbay(key, watchlist)
  } else {
    const key = process.env.PRICECHARTING_API_KEY
    if (!key) {
      console.error("Set PRICECHARTING_API_KEY")
      process.exit(1)
    }
    anomalies = await syncPriceCharting(key, watchlist)
  }

  if (anomalies.length === 0) {
    console.log("No arbitrage anomalies found. Cache unchanged.")
    return
  }

  await writeFile(cachePath, `${JSON.stringify(anomalies, null, 2)}\n`, "utf-8")
  console.log(`Saved ${anomalies.length} anomalies to data/anomalies-cache.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
