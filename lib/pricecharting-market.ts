import {
  extractCardPrices,
  type PriceChartingProduct,
} from "@/lib/pricecharting"
import { isMainlinePokemonSetSlug, isMainlinePokemonTcg, isRecentSetRelease } from "@/lib/pokemon-tcg-filter"
import { buildGradeQuotesFromPrices, getBestGradeQuote } from "@/lib/slab-data"

export interface MarketProductRow {
  pricechartingId: string
  productName: string
  setName: string
  cardNumber: string
  genre?: string
  releaseDate?: string
  rawPrice: number
  psa7: number
  psa8: number
  psa9: number
  psa10: number
  imageUrl?: string
}

export interface ArbitrageCandidate extends MarketProductRow {
  slabGrade: number
  slabPrice: number
  deficit: number
  percentageSavings: number
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function parseMoney(text: string): number {
  const n = Number(text.replace(/[^0-9.]/g, ""))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function slugToSetName(slug: string): string {
  return decodeHtml(slug)
    .replace(/^pokemon-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function extractCardNumber(productName: string, href: string): string {
  const hash = productName.match(/#(\d+)/)?.[1]
  if (hash) return `${hash}`
  const tail = href.split("/").pop() ?? ""
  const fromSlug = tail.match(/(\d{1,4})$/)?.[1]
  return fromSlug ?? ""
}

function prettifyName(slugPart: string): string {
  return slugPart
    .split("-")
    .map((word) => (/^\d+$/.test(word) ? `#${word}` : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ")
    .replace(/ #/g, " #")
}

export async function listPokemonSetSlugs(): Promise<string[]> {
  const res = await fetch("https://www.pricecharting.com/category/pokemon-cards", {
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`Failed to load Pokemon category page: HTTP ${res.status}`)
  const html = await res.text()
  return [...new Set([...html.matchAll(/href="\/console\/(pokemon[^"]+)"/g)].map((m) => decodeHtml(m[1])))]
    .filter(isMainlinePokemonSetSlug)
}

export async function parseSetPageProducts(setSlug: string): Promise<MarketProductRow[]> {
  if (!isMainlinePokemonSetSlug(setSlug)) return []

  const res = await fetch(`https://www.pricecharting.com/console/${encodeURIComponent(setSlug)}`, {
    next: { revalidate: 0 },
  })
  if (!res.ok) return []

  const html = await res.text()
  const setName = slugToSetName(setSlug)
  const products: MarketProductRow[] = []

  for (const [, id, body] of html.matchAll(/<tr id="product-(\d+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const href = body.match(/href="(\/game\/[^"]+)"/)?.[1] ?? ""
    const slugPart = decodeURIComponent(href.split("/").pop() ?? "")
    const productName = prettifyName(slugPart)
    const img = body.match(/src="(https:\/\/[^"]+\/im[^"]+)"/)?.[1]

    const tds = [...body.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)]
    const priceTexts = tds
      .map((m) => m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .filter((text) => /\$[\d,]+/.test(text))

    const prices = priceTexts.map(parseMoney).filter((p) => p > 0)
    if (prices.length < 2) continue

    const rawPrice = prices[0]
    const psa9 = prices[1]
    products.push({
      pricechartingId: id,
      productName,
      setName,
      cardNumber: extractCardNumber(productName, href),
      genre: "Pokemon Card",
      rawPrice,
      psa7: 0,
      psa8: 0,
      psa9,
      psa10: 0,
      imageUrl: img,
    })
  }

  return products
}

function parseCsvPrice(value: string | undefined): number {
  if (!value) return 0
  const trimmed = value.trim()
  if (!trimmed || trimmed === "-" || trimmed === "N/A") return 0

  if (trimmed.includes("$")) {
    return parseMoney(trimmed)
  }

  const numeric = Number(trimmed.replace(/,/g, ""))
  if (!Number.isFinite(numeric) || numeric <= 0) return 0

  // Legendary CSV downloads use dollars; API responses use integer pennies.
  if (Number.isInteger(numeric) && numeric >= 1000) {
    return numeric / 100
  }

  return numeric
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === "," && !inQuotes) {
      cells.push(current)
      current = ""
      continue
    }
    current += ch
  }
  cells.push(current)
  return cells
}

export function parsePriceChartingCsv(text: string): MarketProductRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const idx = (name: string) => headers.indexOf(name)

  const idIdx = idx("id")
  const nameIdx = idx("product-name")
  const consoleIdx = idx("console-name")
  const genreIdx = idx("genre")
  const looseIdx = idx("loose-price")
  const cibIdx = idx("cib-price")
  const newIdx = idx("new-price")
  const gradedIdx = idx("graded-price")
  const manualIdx = idx("manual-only-price")
  const releaseIdx = idx("release-date")

  if (idIdx === -1 || nameIdx === -1 || looseIdx === -1) return []

  const rows: MarketProductRow[] = []

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line)
    const genre = genreIdx >= 0 ? cells[genreIdx]?.trim() : ""
    if (genre !== "Pokemon Card") continue

    const productName = cells[nameIdx]?.trim() ?? "Unknown"
    const setName = consoleIdx >= 0 ? cells[consoleIdx]?.trim() ?? "Pokemon" : "Pokemon"
    if (!isMainlinePokemonTcg({ setName, genre, productName })) continue

    const releaseDate = releaseIdx >= 0 ? cells[releaseIdx]?.trim() : ""
    if (!isRecentSetRelease(releaseDate)) continue

    const rawPrice = parseCsvPrice(cells[looseIdx])
    const psa7 = cibIdx >= 0 ? parseCsvPrice(cells[cibIdx]) : 0
    const psa8 = newIdx >= 0 ? parseCsvPrice(cells[newIdx]) : 0
    const psa9 = gradedIdx >= 0 ? parseCsvPrice(cells[gradedIdx]) : 0
    const psa10 = manualIdx >= 0 ? parseCsvPrice(cells[manualIdx]) : 0

    if (rawPrice <= 0) continue

    rows.push({
      pricechartingId: cells[idIdx]?.trim() ?? "",
      productName,
      setName: consoleIdx >= 0 ? cells[consoleIdx]?.trim() ?? "Pokemon" : "Pokemon",
      cardNumber: extractCardNumber(productName, ""),
      genre: genre || "Pokemon Card",
      releaseDate: releaseDate || undefined,
      rawPrice,
      psa7,
      psa8,
      psa9,
      psa10,
    })
  }

  return rows.filter((row) => row.pricechartingId)
}

export function rowToArbitrage(row: MarketProductRow): ArbitrageCandidate | null {
  const grades = [
    { grade: 7, price: row.psa7 },
    { grade: 8, price: row.psa8 },
    { grade: 9, price: row.psa9 },
    { grade: 10, price: row.psa10 },
  ].filter((g) => g.price > 0)

  if (grades.length === 0 || row.rawPrice <= 0) return null

  let best: ArbitrageCandidate | null = null
  for (const { grade, price } of grades) {
    if (price >= row.rawPrice) continue
    const deficit = row.rawPrice - price
    const percentageSavings = Math.round((deficit / row.rawPrice) * 100)
    if (!best || deficit > best.deficit) {
      best = {
        ...row,
        slabGrade: grade,
        slabPrice: price,
        deficit,
        percentageSavings,
      }
    }
  }

  return best
}

export function findArbitrageCandidates(
  rows: MarketProductRow[],
  options?: { minRawPrice?: number; minDeficit?: number; maxRawPrice?: number },
): ArbitrageCandidate[] {
  const minRaw = options?.minRawPrice ?? 15
  const minDeficit = options?.minDeficit ?? 5
  const maxRaw = options?.maxRawPrice ?? Number(process.env.DISCOVERY_MAX_RAW_PRICE ?? 5000)

  return rows
    .filter((row) => row.rawPrice >= minRaw && row.rawPrice <= maxRaw)
    .filter((row) => isMainlinePokemonTcg({ setName: row.setName, genre: row.genre, productName: row.productName }))
    .filter((row) => isRecentSetRelease(row.releaseDate))
    .map(rowToArbitrage)
    .filter((row): row is ArbitrageCandidate => row !== null && row.deficit >= minDeficit)
    .sort((a, b) => b.deficit - a.deficit)
}

export async function loadMarketProductsFromCsvSource(
  apiKey: string,
  csvPath?: string,
): Promise<MarketProductRow[]> {
  if (csvPath) {
    const { readFile } = await import("node:fs/promises")
    const text = await readFile(csvPath, "utf-8")
    return parsePriceChartingCsv(text)
  }

  const csvUrl = process.env.PRICECHARTING_CSV_URL
  if (csvUrl) {
    const url = csvUrl.includes("t=") ? csvUrl : `${csvUrl}${csvUrl.includes("?") ? "&" : "?"}t=${apiKey}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) throw new Error(`PriceCharting CSV download failed: HTTP ${res.status}`)
    return parsePriceChartingCsv(await res.text())
  }

  return []
}

export async function scrapeAllPokemonSets(
  onProgress?: (done: number, total: number, slug: string) => void,
): Promise<MarketProductRow[]> {
  const slugs = await listPokemonSetSlugs()
  const all: MarketProductRow[] = []

  for (let i = 0; i < slugs.length; i += 1) {
    const slug = slugs[i]
    onProgress?.(i + 1, slugs.length, slug)
    const batch = await parseSetPageProducts(slug)
    all.push(...batch)
    await new Promise((r) => setTimeout(r, 350))
  }

  return all
}

export function mergeApiGrades(row: MarketProductRow, product: PriceChartingProduct): MarketProductRow {
  const { rawPrice, grades } = extractCardPrices(product)
  const byGrade = Object.fromEntries(grades.map((g) => [g.grade, g.price]))
  return {
    ...row,
    productName: product["product-name"] ?? row.productName,
    setName: product["console-name"] ?? row.setName,
    rawPrice: rawPrice > 0 ? rawPrice : row.rawPrice,
    psa7: byGrade[7] ?? row.psa7,
    psa8: byGrade[8] ?? row.psa8,
    psa9: byGrade[9] ?? row.psa9,
    psa10: byGrade[10] ?? row.psa10,
  }
}

export function candidateToAnomalyEntry(candidate: ArbitrageCandidate) {
  const gradeQuotes = buildGradeQuotesFromPrices(candidate.rawPrice, [
    { grade: 7, price: candidate.psa7 },
    { grade: 8, price: candidate.psa8 },
    { grade: 9, price: candidate.psa9 },
    { grade: 10, price: candidate.psa10 },
  ])
  const best = getBestGradeQuote(gradeQuotes)

  return {
    id: `pc-${candidate.pricechartingId}`,
    cardName: candidate.productName,
    setName: candidate.setName,
    cardNumber: candidate.cardNumber,
    imageUrl: candidate.imageUrl ?? "https://placehold.co/150x210",
    rawPrice: candidate.rawPrice,
    slabGrade: best?.grade ?? candidate.slabGrade,
    slabPrice: best?.slabPrice ?? candidate.slabPrice,
    deficit: best?.deficit ?? candidate.deficit,
    percentageSavings: best?.percentageSavings ?? candidate.percentageSavings,
    gradeQuotes,
    marketInsight:
      "Auto-discovered from PriceCharting market scan — graded copy cheaper than raw NM.",
    hasPricing: true,
    pricechartingId: candidate.pricechartingId,
    releaseDate: candidate.releaseDate,
  }
}
