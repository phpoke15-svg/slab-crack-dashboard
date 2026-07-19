import mockData from "@/lib/mockData.json"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import {
  getCatalogCardsClosestToPrice,
  getCatalogCardsInPriceBand,
  type CatalogSearchHit,
} from "@/lib/db/cards-catalog"
import { getRawPriceByCardId } from "@/lib/db/priced-catalog"
import {
  GIVEAWAY_PRIZE_CARD_BAND_PERCENT,
  GIVEAWAY_PRIZE_CARD_PC_CANDIDATE_POOL,
  GIVEAWAY_PRIZE_CARD_PC_LOOKUP_LIMIT,
  GIVEAWAY_PRIZE_CARD_SHOWCASE_LIMIT,
} from "@/lib/giveaway/constants"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { MockCardEntry } from "@/lib/slab-data"
import { attachBinderCardPrices } from "@/lib/trade-binder/binder-prices"
import { cardIdVariants } from "@/lib/trade-binder/card-id-match"
import {
  isEnglishOrJapanesePricedCard,
  type PricedCatalogCard,
} from "@/lib/trade-binder/priced-catalog"

export type GiveawayPrizeCard = {
  id: string
  name: string
  set: string
  cardNumber?: string
  image: string
  rawPrice: number
}

export type PrizeCardPriceBand = {
  min: number
  max: number
  target: number
}

export type GiveawayPrizeCardsResult = {
  band: PrizeCardPriceBand
  cards: GiveawayPrizeCard[]
  usedLivePriceCharting: boolean
}

type PrizeCardSource = {
  id: string
  name: string
  setName: string
  cardNumber?: string
  rarity?: string | null
  image?: string | null
  rawPrice: number
}

type SlabCardRow = {
  id: string
  name: string
  set_name: string
  card_number: string
  rarity: string | null
  image_large: string | null
  image_small: string | null
}

function roundUsd(amount: number): number {
  return Math.round(amount * 100) / 100
}

/** Symmetric ±5% band around a target ARV (strict — no minimum padding). */
export function prizeCardPriceBand(
  targetUsd: number,
  bandPercent = GIVEAWAY_PRIZE_CARD_BAND_PERCENT,
): PrizeCardPriceBand {
  const target = roundUsd(Math.max(0, targetUsd))
  if (target <= 0) return { min: 0, max: 0, target: 0 }

  const padding = target * bandPercent
  return {
    target,
    min: roundUsd(Math.max(0.01, target - padding)),
    max: roundUsd(target + padding),
  }
}

export function isWithinPrizeCardBand(
  rawPrice: number,
  targetUsd: number,
  bandPercent = GIVEAWAY_PRIZE_CARD_BAND_PERCENT,
): boolean {
  const band = prizeCardPriceBand(targetUsd, bandPercent)
  return rawPrice >= band.min && rawPrice <= band.max
}

function formatCardName(name: string): string {
  return name.replace(/\s+\([^)]+\)$/, "").trim() || name
}

function formatPrizeCardDisplayName(name: string, rarity?: string | null): string {
  if (!rarity || name.toLowerCase().includes(rarity.toLowerCase())) return name
  return `${name} (${rarity})`
}

function toGiveawayPrizeCard(source: PrizeCardSource): GiveawayPrizeCard | null {
  if (source.rawPrice <= 0) return null
  if (!isEnglishOrJapanesePricedCard({ setName: source.setName, productName: source.name })) {
    return null
  }

  return {
    id: source.id,
    name: formatPrizeCardDisplayName(source.name, source.rarity),
    set: source.setName,
    cardNumber: source.cardNumber || undefined,
    image: upgradeCardImageUrlSync(source.image ?? "/placeholder.svg"),
    rawPrice: source.rawPrice,
  }
}

export function catalogHitToGiveawayPrizeCard(hit: CatalogSearchHit): GiveawayPrizeCard | null {
  if (!hit.rawPrice || hit.rawPrice <= 0) return null
  return toGiveawayPrizeCard({
    id: hit.id,
    name: hit.name,
    setName: hit.setName,
    cardNumber: hit.number,
    rarity: hit.rarity,
    image: hit.imageUrl,
    rawPrice: hit.rawPrice,
  })
}

function scorePrizeCard(card: GiveawayPrizeCard, target: number): number {
  const distance = Math.abs(card.rawPrice - target)
  const hasRealImage = card.image && !card.image.includes("placeholder")
  return distance - (hasRealImage ? 0.25 : 0)
}

function sortPrizeCards(cards: GiveawayPrizeCard[], target: number): GiveawayPrizeCard[] {
  return [...cards].sort((a, b) => {
    const scoreDiff = scorePrizeCard(a, target) - scorePrizeCard(b, target)
    if (scoreDiff !== 0) return scoreDiff
    return a.name.localeCompare(b.name)
  })
}

function mockEntryToPrizeCard(entry: MockCardEntry): GiveawayPrizeCard | null {
  if (entry.rawPrice <= 0 || entry.hasPricing === false) return null
  return toGiveawayPrizeCard({
    id: entry.id,
    name: formatCardName(entry.cardName),
    setName: entry.setName,
    cardNumber: entry.cardNumber,
    image: entry.imageUrl,
    rawPrice: entry.rawPrice,
  })
}

function collectMockCards(
  target: number,
  options?: { min?: number; max?: number; limit?: number },
): GiveawayPrizeCard[] {
  const cards: GiveawayPrizeCard[] = []
  for (const entry of mockData as MockCardEntry[]) {
    if (options?.min != null && entry.rawPrice < options.min) continue
    if (options?.max != null && entry.rawPrice > options.max) continue
    const card = mockEntryToPrizeCard(entry)
    if (card) cards.push(card)
  }

  const sorted = sortPrizeCards(cards, target)
  return options?.limit ? sorted.slice(0, options.limit) : sorted
}

function trackCardVariants(cardId: string, seenIds: Set<string>) {
  for (const variant of cardIdVariants(cardId)) {
    seenIds.add(variant)
  }
}

function hasTrackedVariant(cardId: string, seenIds: Set<string>): boolean {
  return cardIdVariants(cardId).some((variant) => seenIds.has(variant))
}

async function fetchSlabCardsById(cardIds: string[]): Promise<Map<string, SlabCardRow>> {
  if (!cardIds.length) return new Map()

  const admin = createAdminClient()
  const byId = new Map<string, SlabCardRow>()

  for (let i = 0; i < cardIds.length; i += 100) {
    const chunk = cardIds.slice(i, i + 100)
    const { data, error } = await admin
      .from("slab_cards")
      .select("id, name, set_name, card_number, rarity, image_large, image_small")
      .in("id", chunk)

    if (error) throw error
    for (const row of (data ?? []) as SlabCardRow[]) {
      byId.set(row.id, row)
    }
  }

  return byId
}

function resolveSlabForPriceId(
  cardId: string,
  slabById: Map<string, SlabCardRow>,
): SlabCardRow | undefined {
  for (const variant of cardIdVariants(cardId)) {
    const slab = slabById.get(variant)
    if (slab) return slab
  }
  return undefined
}

async function legacySlabMatches(
  band: PrizeCardPriceBand,
  fetchLimit: number,
  seenIds: Set<string>,
  cachedPrices: Map<string, number>,
): Promise<GiveawayPrizeCard[]> {
  const ranked = [...cachedPrices.entries()]
    .map(([cardId, rawPrice]) => ({ cardId, rawPrice: Number(rawPrice) }))
    .filter((row) => row.rawPrice > 0)
    .filter((row) => row.rawPrice >= band.min && row.rawPrice <= band.max)
    .filter((row) => !hasTrackedVariant(row.cardId, seenIds))
    .sort((a, b) => Math.abs(a.rawPrice - band.target) - Math.abs(b.rawPrice - band.target))
    .slice(0, fetchLimit)

  if (!ranked.length) return []

  const slabById = await fetchSlabCardsById(
    [...new Set(ranked.flatMap((row) => cardIdVariants(row.cardId)))],
  )

  const cards: GiveawayPrizeCard[] = []
  for (const row of ranked) {
    const slab = resolveSlabForPriceId(row.cardId, slabById)
    if (!slab) continue
    const card = toGiveawayPrizeCard({
      id: row.cardId,
      name: slab.name,
      setName: slab.set_name,
      cardNumber: slab.card_number,
      rarity: slab.rarity,
      image: slab.image_large ?? slab.image_small,
      rawPrice: row.rawPrice,
    })
    if (card && isWithinPrizeCardBand(card.rawPrice, band.target)) {
      cards.push(card)
    }
  }

  return sortPrizeCards(cards, band.target)
}

async function pricedCatalogMatches(
  band: PrizeCardPriceBand,
  fetchLimit: number,
): Promise<GiveawayPrizeCard[]> {
  const cards: GiveawayPrizeCard[] = []
  const seenIds = new Set<string>()

  const catalogHits = await getCatalogCardsInPriceBand(band.min, band.max, band.target, fetchLimit)
  for (const hit of catalogHits) {
    const card = catalogHitToGiveawayPrizeCard(hit)
    if (!card || !isWithinPrizeCardBand(card.rawPrice, band.target)) continue
    cards.push(card)
    trackCardVariants(card.id, seenIds)
  }

  if (cards.length < fetchLimit) {
    const cachedPrices = await getRawPriceByCardId()
    const legacy = await legacySlabMatches(band, fetchLimit - cards.length, seenIds, cachedPrices)
    for (const card of legacy) {
      if (hasTrackedVariant(card.id, seenIds)) continue
      cards.push(card)
      trackCardVariants(card.id, seenIds)
    }
  }

  return sortPrizeCards(cards, band.target)
}

async function closestPrizeCards(target: number, limit: number): Promise<GiveawayPrizeCard[]> {
  if (!isSupabaseConfigured()) {
    return collectMockCards(target, { limit })
  }

  try {
    const hits = await getCatalogCardsClosestToPrice(target, limit)
    const cards = hits
      .map((hit) => catalogHitToGiveawayPrizeCard(hit))
      .filter((card): card is GiveawayPrizeCard => card != null)
    if (cards.length) return sortPrizeCards(cards, target).slice(0, limit)
  } catch (error) {
    console.warn("[giveaway-prize-cards] closest catalog match failed:", error)
  }

  return collectMockCards(target, { limit })
}

async function queryCatalogInBand(band: PrizeCardPriceBand): Promise<GiveawayPrizeCard[]> {
  if (!isSupabaseConfigured()) {
    const inBand = collectMockCards(band.target, { min: band.min, max: band.max })
    if (inBand.length) return inBand
    return collectMockCards(band.target, { limit: GIVEAWAY_PRIZE_CARD_SHOWCASE_LIMIT })
  }

  try {
    const cards = await pricedCatalogMatches(band, GIVEAWAY_PRIZE_CARD_SHOWCASE_LIMIT * 6)
    if (cards.length) return cards
  } catch (error) {
    console.warn("[giveaway-prize-cards] priced catalog query failed:", error)
  }

  return []
}

async function priceChartingCardsInBand(
  band: PrizeCardPriceBand,
  limit: number,
  excludeIds: Set<string>,
): Promise<GiveawayPrizeCard[]> {
  if (!process.env.PRICECHARTING_API_KEY || !isSupabaseConfigured()) return []

  const candidates = (await getCatalogCardsClosestToPrice(
    band.target,
    GIVEAWAY_PRIZE_CARD_PC_CANDIDATE_POOL,
  )).filter((hit) => !hasTrackedVariant(hit.id, excludeIds))

  const cachedPrices = await getRawPriceByCardId()
  const priced = await attachBinderCardPrices(
    candidates.map((hit) => ({
      id: hit.id,
      name: hit.name,
      set: hit.setName,
      cardNumber: hit.number,
    })),
    {
      cachedPrices,
      limit: GIVEAWAY_PRIZE_CARD_PC_LOOKUP_LIMIT,
      concurrency: 2,
    },
  )

  const cards: GiveawayPrizeCard[] = []
  for (const hit of candidates) {
    const rawPrice = priced.get(hit.id)
    if (!rawPrice || !isWithinPrizeCardBand(rawPrice, band.target)) continue
    const card = catalogHitToGiveawayPrizeCard({ ...hit, rawPrice })
    if (card) cards.push(card)
    if (cards.length >= limit) break
  }

  return sortPrizeCards(cards, band.target)
}

function dedupePrizeCards(cards: GiveawayPrizeCard[], limit: number): GiveawayPrizeCard[] {
  const seen = new Set<string>()
  const unique: GiveawayPrizeCard[] = []
  for (const card of cards) {
    if (seen.has(card.id)) continue
    seen.add(card.id)
    unique.push(card)
    if (unique.length >= limit) break
  }
  return unique
}

/** Cards from the priced catalog within ±5% of today's prize ARV. */
export async function getGiveawayPrizeCards(
  targetUsd: number,
  limit = GIVEAWAY_PRIZE_CARD_SHOWCASE_LIMIT,
): Promise<GiveawayPrizeCardsResult> {
  const band = prizeCardPriceBand(targetUsd)
  if (band.target <= 0) {
    return { band: { min: 0, max: 0, target: 0 }, cards: [], usedLivePriceCharting: false }
  }

  let cached = dedupePrizeCards(await queryCatalogInBand(band), limit)

  let usedLivePriceCharting = false
  if (cached.length < limit) {
    const excludeIds = new Set(cached.map((card) => card.id))
    const live = await priceChartingCardsInBand(band, limit - cached.length, excludeIds)
    if (live.length) {
      usedLivePriceCharting = true
      cached = dedupePrizeCards([...cached, ...live], limit)
    }
  }

  if (!cached.length) {
    cached = await closestPrizeCards(band.target, limit)
  }

  return {
    band,
    cards: cached,
    usedLivePriceCharting,
  }
}

/** Map priced catalog rows (tests / reuse). */
export function pricedCatalogToGiveawayCards(
  catalog: PricedCatalogCard[],
  targetUsd: number,
  limit = GIVEAWAY_PRIZE_CARD_SHOWCASE_LIMIT,
): { band: PrizeCardPriceBand; cards: GiveawayPrizeCard[] } {
  const band = prizeCardPriceBand(targetUsd)
  const cards = sortPrizeCards(
    catalog
      .filter((card) => isWithinPrizeCardBand(card.rawPrice, band.target))
      .map((card) => ({
        id: card.id,
        name: card.name,
        set: card.set,
        cardNumber: card.cardNumber,
        image: upgradeCardImageUrlSync(card.image),
        rawPrice: card.rawPrice,
      })),
    band.target,
  ).slice(0, limit)

  return { band, cards }
}
