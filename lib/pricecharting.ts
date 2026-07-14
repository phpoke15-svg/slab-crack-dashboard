/** PriceCharting API helpers — prices are returned in pennies (integer). */

const PRODUCT_URL = "https://www.pricecharting.com/api/product"
const PRODUCTS_URL = "https://www.pricecharting.com/api/products"

export interface PriceChartingSearchHit {
  id?: string
  "product-name"?: string
  "console-name"?: string
}

export interface PriceChartingCardContext {
  cardName: string
  setName: string
  cardNumber: string
}

export interface PriceChartingProduct {
  id?: string
  "product-name"?: string
  "console-name"?: string
  "loose-price"?: number
  "cib-price"?: number
  "new-price"?: number
  "graded-price"?: number
  "manual-only-price"?: number
  status?: string
}

export interface GradePrice {
  grade: number
  price: number
}

export interface ArbitrageResult {
  slabGrade: number
  slabPrice: number
  deficit: number
  percentageSavings: number
}

/** Convert PriceCharting penny values to dollars. */
export function parsePriceCents(value: unknown): number {
  if (value == null || value === "") return 0
  const cents = typeof value === "string" ? parseInt(value, 10) : Number(value)
  if (!Number.isFinite(cents) || cents <= 0) return 0
  return cents / 100
}

/** Map PriceCharting card fields to PSA grade prices (see API docs). */
export function extractCardPrices(product: PriceChartingProduct) {
  const rawPrice = parsePriceCents(product["loose-price"])
  const grades: GradePrice[] = [
    { grade: 7, price: parsePriceCents(product["cib-price"]) },
    { grade: 8, price: parsePriceCents(product["new-price"]) },
    { grade: 9, price: parsePriceCents(product["graded-price"]) },
    { grade: 10, price: parsePriceCents(product["manual-only-price"]) },
  ]
  return { rawPrice, grades, name: product["product-name"] ?? "Unknown card" }
}

/** Find the graded copy with the largest savings vs raw NM. */
export function findBestArbitrage(
  rawPrice: number,
  grades: GradePrice[],
): ArbitrageResult | null {
  if (rawPrice <= 0) return null

  let best: ArbitrageResult | null = null

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

export function stripRarityFromName(name: string): string {
  return name.replace(/\s+\([^)]+\)/, "").trim()
}

export function cardNumberPrefix(cardNumber: string): string {
  return cardNumber.split("/")[0]?.trim() ?? cardNumber
}

export function shortSetName(setName: string): string {
  return setName
    .replace(/^(Scarlet & Violet|Sword & Shield|Sun & Moon|XY|Black & White):\s*/i, "")
    .trim()
}

/** PriceCharting-friendly search strings (best first). */
export function buildPriceChartingSearchQueries(
  cardName: string,
  setName: string,
  cardNumber: string,
): string[] {
  const name = stripRarityFromName(cardName).toLowerCase()
  const num = cardNumberPrefix(cardNumber)
  const setShort = shortSetName(setName).toLowerCase()

  const queries = [
    `${name} #${num} ${setShort}`,
    `${name} #${num} pokemon ${setShort}`,
    `${name} ${setShort} pokemon`,
    `${name} #${num}`,
    `${name} ${setShort}`,
  ]

  return [...new Set(queries.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean))]
}

export function scorePriceChartingMatch(
  hit: PriceChartingSearchHit,
  ctx: PriceChartingCardContext,
): number {
  const productName = (hit["product-name"] ?? "").toLowerCase()
  const consoleName = (hit["console-name"] ?? "").toLowerCase()
  const name = stripRarityFromName(ctx.cardName).toLowerCase()
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

export async function fetchPriceChartingProducts(
  apiKey: string,
  query: string,
): Promise<PriceChartingSearchHit[]> {
  const params = new URLSearchParams({ t: apiKey, q: query })
  const response = await fetch(`${PRODUCTS_URL}?${params.toString()}`, {
    next: { revalidate: 0 },
  })
  if (!response.ok) throw new Error(`PriceCharting HTTP ${response.status}`)
  const data = (await response.json()) as { status?: string; products?: PriceChartingSearchHit[] }
  if (data.status === "error") return []
  return data.products ?? []
}

export async function fetchPriceChartingProduct(
  apiKey: string,
  options: { id?: string; query?: string },
): Promise<PriceChartingProduct> {
  const params = new URLSearchParams({ t: apiKey })
  if (options.id) params.set("id", options.id)
  else if (options.query) params.set("q", options.query)
  else throw new Error("Either priceChartingId or searchQuery is required")

  const response = await fetch(`${PRODUCT_URL}?${params.toString()}`, {
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`PriceCharting HTTP ${response.status}`)
  }

  const data = (await response.json()) as PriceChartingProduct
  if (data.status === "error") {
    throw new Error("PriceCharting returned an error for this product")
  }

  return data
}

export async function resolvePriceChartingForCard(
  apiKey: string,
  card: PriceChartingCardContext & {
    priceChartingId?: string
    searchQuery?: string
    /** Scan/identify path: fewer PriceCharting round-trips. */
    fast?: boolean
  },
): Promise<{ product: PriceChartingProduct; resolvedId?: string }> {
  if (card.priceChartingId) {
    const product = await fetchPriceChartingProduct(apiKey, { id: card.priceChartingId })
    return { product, resolvedId: card.priceChartingId }
  }

  const queries = [
    ...(card.searchQuery ? [card.searchQuery] : []),
    ...buildPriceChartingSearchQueries(card.cardName, card.setName, card.cardNumber),
  ]
  const uniqueQueries = [...new Set(queries)].slice(0, card.fast ? 2 : 4)

  let bestId: string | undefined
  let bestScore = 0

  async function scoreQuery(query: string) {
    const hits = await fetchPriceChartingProducts(apiKey, query)
    let localBestId: string | undefined
    let localBestScore = 0
    for (const hit of hits) {
      if (!hit.id) continue
      const score = scorePriceChartingMatch(hit, card)
      if (score > localBestScore) {
        localBestScore = score
        localBestId = hit.id
      }
    }
    return { id: localBestId, score: localBestScore }
  }

  const batches = card.fast
    ? [uniqueQueries].filter((b) => b.length > 0)
    : [uniqueQueries.slice(0, 2), uniqueQueries.slice(2, 4)].filter((b) => b.length > 0)

  for (const batch of batches) {
    const results = await Promise.all(batch.map((query) => scoreQuery(query)))
    for (const result of results) {
      if (result.score > bestScore) {
        bestScore = result.score
        bestId = result.id
      }
    }
    if (bestScore >= (card.fast ? 12 : 18) && bestId) break
  }

  if (bestId && bestScore >= 10) {
    const product = await fetchPriceChartingProduct(apiKey, { id: bestId })
    return { product, resolvedId: bestId }
  }

  const fallbackQuery = uniqueQueries[0]
  if (!fallbackQuery) throw new Error("No PriceCharting search query available")
  const product = await fetchPriceChartingProduct(apiKey, { query: fallbackQuery })
  return { product }
}

export function formatArbitrageAlert(cardName: string, result: ArbitrageResult): string {
  return `[ALERT] Arbitrage found on ${cardName}! PSA ${result.slabGrade} is $${result.deficit.toFixed(2)} cheaper than Raw.`
}
