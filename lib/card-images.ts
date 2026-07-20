import { hasTcgGoApiKey } from "@/lib/pricing/provider"
import { resolveTcgGoCardForTarget, tcgGoCardImageUrl } from "@/lib/tcggo-api"
import {
  bestKnownImageUrl,
  cardImageNeedsUpgrade,
  upgradeCardImageUrlSync,
} from "@/lib/card-image-url"

const PLACEHOLDER_HOSTS = ["placehold.co", "via.placeholder.com"]

export function isPlaceholderImage(url: string | undefined | null): boolean {
  if (!url) return true
  try {
    const host = new URL(url).hostname
    return PLACEHOLDER_HOSTS.some((h) => host.includes(h))
  } catch {
    return true
  }
}

export function extractCardNumberFromName(name: string): string {
  const hash = name.match(/#(\d+)/)?.[1]
  return hash ?? ""
}

export function cleanCardNameForLookup(name: string): string {
  return name
    .replace(/\s*\[[^\]]+\]/g, "")
    .replace(/\s+\([^)]+\)/, "")
    .replace(/\s+#\d+.*$/i, "")
    .replace(/\bEX\b/g, "ex")
    .replace(/\s+/g, " ")
    .trim()
}

export function priceChartingSetSlug(setName: string): string {
  const withoutPrefix = setName.replace(/^Pokemon\s+/i, "").trim()
  return (
    "pokemon-" +
    withoutPrefix
      .toLowerCase()
      .replace(/\s*&\s*/g, "-&-")
      .replace(/[^a-z0-9&-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  )
}

export function priceChartingProductSlug(productName: string): string {
  return productName
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/\s*\[([^\]]+)\]\s*/g, "-$1-")
    .replace(/#/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function upgradePriceChartingHashTo1600(url: string): string {
  return upgradeCardImageUrlSync(url)
}

function largestImageForHash(html: string, hash: string): string | null {
  const sizes = [...html.matchAll(
    new RegExp(`images\\.pricecharting\\.com/${hash}/(\\d+)\\.jpg`, "g"),
  )].map((m) => Number(m[1]))

  if (sizes.length === 0) return null
  const target = sizes.includes(1600) ? 1600 : sizes.includes(400) ? 400 : Math.max(...sizes)
  return `https://storage.googleapis.com/images.pricecharting.com/${hash}/${target}.jpg`
}

function extractImageFromProductHtml(html: string): string | null {
  const og =
    html.match(/property="og:image"[^>]+content="([^"]+)"/i)?.[1] ??
    html.match(/content="([^"]+)"[^>]+property="og:image"/i)?.[1]

  if (og?.includes("images.pricecharting.com")) {
    return upgradePriceChartingHashTo1600(og)
  }

  const hashes = new Set<string>()
  for (const match of html.matchAll(/images\.pricecharting\.com\/([a-z0-9]+)\/\d+\.jpg/g)) {
    hashes.add(match[1])
  }

  let best: string | null = null
  let bestSize = 0
  for (const hash of hashes) {
    const url = largestImageForHash(html, hash)
    if (!url) continue
    const size = Number(url.match(/\/(\d+)\.jpg$/)?.[1] ?? 0)
    if (size > bestSize) {
      bestSize = size
      best = url
    }
  }

  return best
}

function isPriceChartingSearchResults(html: string): boolean {
  return /Your search for .+ found \d+ items/i.test(html)
}

function productPageMatches(html: string, productName: string): boolean {
  if (isPriceChartingSearchResults(html)) return false

  const cardNumber = extractCardNumberFromName(productName)
  if (cardNumber) {
    const numPattern = new RegExp(`#${cardNumber}\\b`)
    if (!numPattern.test(html)) return false
  }

  const lookupName = cleanCardNameForLookup(productName).toLowerCase()
  const heading = html.match(/<h1[^>]*>([^<]+)/i)?.[1]?.toLowerCase() ?? ""
  const firstToken = lookupName.split(/\s+/)[0]
  if (firstToken && !heading.includes(firstToken)) return false

  return html.includes("Ungraded") || html.includes("Compare vs Other Items")
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SlabCrack/1.0" },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function fetchPriceChartingArtworkFromSetPage(
  pricechartingId: string,
  setName: string,
): Promise<string | null> {
  const setSlug = priceChartingSetSlug(setName)
  if (!setSlug) return null

  const html = await fetchHtml(`https://www.pricecharting.com/console/${encodeURIComponent(setSlug)}`)
  if (!html) return null

  const row = html.match(new RegExp(`<tr id="product-${pricechartingId}"[^>]*>([\\s\\S]*?)</tr>`))
  if (!row) return null

  return extractImageFromProductHtml(row[1])
}

async function fetchPriceChartingArtworkFromGamePage(
  setName: string,
  productName: string,
): Promise<string | null> {
  const setSlug = priceChartingSetSlug(setName)
  const productSlug = priceChartingProductSlug(productName)
  if (!setSlug || !productSlug) return null

  const html = await fetchHtml(`https://www.pricecharting.com/game/${setSlug}/${productSlug}`)
  if (!html || !productPageMatches(html, productName)) return null

  return extractImageFromProductHtml(html)
}

async function fetchPriceChartingArtwork(input: {
  pricechartingId: string
  setName: string
  productName: string
}): Promise<string | null> {
  const fromSetRow = await fetchPriceChartingArtworkFromSetPage(input.pricechartingId, input.setName)
  if (fromSetRow) return fromSetRow

  return fetchPriceChartingArtworkFromGamePage(input.setName, input.productName)
}

function upgradePriceChartingImageUrlLocal(url: string): string {
  return upgradeCardImageUrlSync(url)
}

/** pokemon-api.com (TCGGO) first, then legacy Pokémon/PriceCharting fallbacks. */
export async function resolveCardArtwork(input: {
  cardName: string
  setName: string
  cardNumber: string
  imageUrl?: string
  pricechartingId?: string
  pokemonTcgId?: string
}): Promise<string | null> {
  const cardNumber = input.cardNumber || extractCardNumberFromName(input.cardName)
  const lookupName = cleanCardNameForLookup(input.cardName)

  if (hasTcgGoApiKey()) {
    const tcgId = input.pokemonTcgId?.replace(/^poke-/, "")
    const card = await resolveTcgGoCardForTarget({
      cardId: tcgId ? `poke-${tcgId}` : `poke-${lookupName}`,
      cardName: lookupName,
      setName: input.setName,
      cardNumber,
    })
    const tcgImage = card ? tcgGoCardImageUrl(card) : null
    if (tcgImage) return tcgImage
  }

  const { resolvePokemonCardImage, fetchPokemonCardForWatchlist } = await import("@/lib/pokemon-tcg")
  const fromPokemon = await resolvePokemonCardImage({
    cardName: lookupName,
    setName: input.setName,
    cardNumber,
  })
  if (fromPokemon?.imageLarge) return fromPokemon.imageLarge
  if (fromPokemon?.imageSmall) return fromPokemon.imageSmall

  if (input.pricechartingId) {
    const fromPc = await fetchPriceChartingArtwork({
      pricechartingId: input.pricechartingId,
      setName: input.setName,
      productName: input.cardName,
    })
    if (fromPc) return fromPc
  }

  const catalog = await fetchPokemonCardForWatchlist({
    cardName: lookupName,
    setName: input.setName,
    cardNumber,
  })

  if (catalog?.imageLarge) return catalog.imageLarge
  if (catalog?.imageSmall) return catalog.imageSmall

  if (input.imageUrl && !isPlaceholderImage(input.imageUrl)) {
    const upgraded = upgradePriceChartingImageUrlLocal(input.imageUrl)
    if (upgraded && !cardImageNeedsUpgrade(upgraded)) return upgraded
    if (!input.imageUrl.includes("storage.googleapis.com")) {
      const known = bestKnownImageUrl(input.imageUrl)
      if (known && !cardImageNeedsUpgrade(known)) return known
    }
    return input.imageUrl
  }
}

export async function enrichEntryImages<T extends {
  id?: string
  cardName: string
  setName: string
  cardNumber: string
  imageUrl: string
}>(
  entries: T[],
  onProgress?: (done: number, total: number) => void,
  options?: { forceRefresh?: boolean },
): Promise<{ entries: T[]; resolved: number }> {
  const forceRefresh = options?.forceRefresh ?? false
  let resolved = 0
  const updated: T[] = []

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    onProgress?.(i + 1, entries.length)

    const isDiscovered = entry.id?.startsWith("pc-") ?? false
    const needsLookup =
      forceRefresh ||
      isDiscovered ||
      cardImageNeedsUpgrade(entry.imageUrl)

    if (!needsLookup) {
      updated.push(entry)
      continue
    }

    const artwork = await resolveCardArtwork({
      ...entry,
      cardNumber: entry.cardNumber || extractCardNumberFromName(entry.cardName),
      pricechartingId: entry.id?.replace(/^pc-/, ""),
    })
    if (artwork && artwork !== entry.imageUrl) {
      resolved += 1
      updated.push({ ...entry, imageUrl: artwork })
    } else {
      updated.push(entry)
    }

    await new Promise((r) => setTimeout(r, 120))
  }

  return { entries: updated, resolved }
}
