const PRODUCT_URL = "https://www.pricecharting.com/api/product"
const PRODUCTS_URL = "https://www.pricecharting.com/api/products"

function parsePriceCents(value) {
  if (value == null || value === "") return 0
  const cents = typeof value === "string" ? parseInt(value, 10) : Number(value)
  if (!Number.isFinite(cents) || cents <= 0) return 0
  return cents / 100
}

function stripRarity(name) {
  return String(name || "")
    .replace(/\s+\([^)]+\)/, "")
    .trim()
}

function numberPrefix(cardNumber) {
  return String(cardNumber || "").split("/")[0]?.trim() || String(cardNumber || "")
}

function shortSet(setName) {
  return String(setName || "")
    .replace(/^(Scarlet & Violet|Sword & Shield|Sun & Moon|XY|Black & White):\s*/i, "")
    .trim()
}

function buildQueries(name, setName, number) {
  const n = stripRarity(name).toLowerCase()
  const num = numberPrefix(number)
  const set = shortSet(setName).toLowerCase()
  return [
    ...new Set(
      [`${n} #${num} ${set}`, `${n} #${num} pokemon ${set}`, `${n} ${set} pokemon`, `${n} #${num}`, `${n} ${set}`]
        .map((q) => q.replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  ]
}

function scoreHit(hit, ctx) {
  const productName = (hit["product-name"] || "").toLowerCase()
  const consoleName = (hit["console-name"] || "").toLowerCase()
  const name = stripRarity(ctx.name).toLowerCase()
  const num = numberPrefix(ctx.number).toLowerCase()
  const set = shortSet(ctx.set).toLowerCase()
  let score = 0
  if (productName.includes(name) || name.split(" ").every((w) => w && productName.includes(w))) score += 12
  if (productName.includes(`#${num}`) || productName.includes(` ${num} `)) score += 8
  if (consoleName.includes("pokemon")) score += 4
  for (const token of set.split(/\s+/).filter((t) => t.length > 2)) {
    if (consoleName.includes(token) || productName.includes(token)) score += 3
  }
  if (consoleName.includes(set) || productName.includes(set)) score += 6
  return score
}

async function searchProducts(apiKey, query) {
  const params = new URLSearchParams({ t: apiKey, q: query })
  const response = await fetch(`${PRODUCTS_URL}?${params}`)
  if (!response.ok) throw new Error(`PriceCharting search HTTP ${response.status}`)
  const data = await response.json()
  if (data.status === "error") return []
  return data.products || []
}

async function fetchProduct(apiKey, { id, query }) {
  const params = new URLSearchParams({ t: apiKey })
  if (id) params.set("id", id)
  else if (query) params.set("q", query)
  else throw new Error("id or query required")
  const response = await fetch(`${PRODUCT_URL}?${params}`)
  if (!response.ok) throw new Error(`PriceCharting product HTTP ${response.status}`)
  const data = await response.json()
  if (data.status === "error") throw new Error("PriceCharting product error")
  return data
}

function toPricePayload(product, card) {
  const raw = parsePriceCents(product["loose-price"])
  const psa7 = parsePriceCents(product["cib-price"])
  const psa8 = parsePriceCents(product["new-price"])
  const psa9 = parsePriceCents(product["graded-price"])
  const psa10 = parsePriceCents(product["manual-only-price"])
  return {
    slot: card.slot,
    name: card.name,
    set: card.set,
    number: card.number,
    productName: product["product-name"] || card.name,
    consoleName: product["console-name"] || "",
    productId: product.id ? String(product.id) : null,
    prices: {
      rawNm: raw,
      psa7,
      psa8,
      psa9,
      psa10,
    },
    // Simple “trend” proxies from grade ladder (no historical series in free API).
    trend: {
      rawNm: raw,
      gradedSpread: raw > 0 && psa10 > 0 ? Number((psa10 - raw).toFixed(2)) : null,
      bestGrade:
        [
          { grade: 10, price: psa10 },
          { grade: 9, price: psa9 },
          { grade: 8, price: psa8 },
          { grade: 7, price: psa7 },
        ].find((g) => g.price > 0) || null,
    },
  }
}

/**
 * @param {{ slot: number, name: string, set?: string, number?: string }} card
 * @param {string} apiKey
 */
export async function priceCard(card, apiKey) {
  const key = (apiKey || process.env.PRICECHARTING_API_KEY || "").trim()
  if (!key) throw new Error("PRICECHARTING_API_KEY is not configured.")

  const queries = buildQueries(card.name, card.set || "", card.number || "").slice(0, 3)
  let bestId = null
  let bestScore = 0

  for (const query of queries) {
    const hits = await searchProducts(key, query)
    for (const hit of hits) {
      if (!hit.id) continue
      const score = scoreHit(hit, card)
      if (score > bestScore) {
        bestScore = score
        bestId = String(hit.id)
      }
    }
    if (bestScore >= 18) break
  }

  const product = bestId
    ? await fetchProduct(key, { id: bestId })
    : await fetchProduct(key, { query: queries[0] })

  return toPricePayload(product, card)
}

const PRICE_LOOKUP_CONCURRENCY = 4

async function mapPool(items, concurrency, worker) {
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor
        cursor += 1
        await worker(items[i], i)
      }
    }),
  )
}

/**
 * @param {{ slot: number, name: string, set?: string, number?: string }[]} cards
 * @param {string} [apiKey]
 */
export async function priceCards(cards, apiKey) {
  return mapPool(cards, PRICE_LOOKUP_CONCURRENCY, async (card) => {
    try {
      return { ok: true, ...(await priceCard(card, apiKey)) }
    } catch (err) {
      return {
        ok: false,
        slot: card.slot,
        name: card.name,
        set: card.set || "",
        number: card.number || "",
        error: err instanceof Error ? err.message : "Price lookup failed",
      }
    }
  })
}
