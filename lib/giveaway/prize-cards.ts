import mockData from "@/lib/mockData.json"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
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

function mockCardsInBand(min: number, max: number, target: number): GiveawayPrizeCard[] {
  const cards: GiveawayPrizeCard[] = []
  for (const entry of mockData as MockCardEntry[]) {
    if (entry.rawPrice <= 0 || entry.hasPricing === false) continue
    if (entry.rawPrice < min || entry.rawPrice > max) continue
    if (!isEnglishOrJapanesePricedCard({ setName: entry.setName, productName: entry.cardName })) {
      continue
    }

    cards.push({
      id: entry.id,
      name: formatCardName(entry.cardName),
      set: entry.setName,
      cardNumber: entry.cardNumber,
      image: upgradeCardImageUrlSync(entry.imageUrl),
      rawPrice: entry.rawPrice,
    })
  }

  return sortPrizeCards(cards, target)
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

function slabToPrizeCard(slab: SlabCardRow, rawPrice: number): GiveawayPrizeCard | null {
  if (!isEnglishOrJapanesePricedCard({ setName: slab.set_name, productName: slab.name })) {
    return null
  }

  const image = upgradeCardImageUrlSync(slab.image_large ?? slab.image_small ?? "/placeholder.svg")
  const rarity = slab.rarity
  const displayName =
    rarity && !slab.name.toLowerCase().includes(rarity.toLowerCase())
      ? `${slab.name} (${rarity})`
      : slab.name

  return {
    id: slab.id,
    name: displayName,
    set: slab.set_name,
    cardNumber: slab.card_number || undefined,
    image,
    rawPrice,
  }
}

async function pricedCatalogMatches(
  band: PrizeCardPriceBand,
  fetchLimit: number,
): Promise<GiveawayPrizeCard[]> {
  const priceByCardId = await getRawPriceByCardId()
  const ranked = [...priceByCardId.entries()]
    .map(([cardId, rawPrice]) => ({ cardId, rawPrice: Number(rawPrice) }))
    .filter((row) => row.rawPrice > 0)
    .filter((row) => row.rawPrice >= band.min && row.rawPrice <= band.max)
    .sort((a, b) => Math.abs(a.rawPrice - band.target) - Math.abs(b.rawPrice - band.target))
    .slice(0, fetchLimit)

  if (!ranked.length) return []

  const slabById = await fetchSlabCardsById(ranked.map((row) => row.cardId))
  const cards: GiveawayPrizeCard[] = []

  for (const row of ranked) {
    const slab = slabById.get(row.cardId)
    if (!slab) continue
    const card = slabToPrizeCard(slab, row.rawPrice)
    if (card && isWithinPrizeCardBand(card.rawPrice, band.target)) {
      cards.push(card)
    }
  }

  return sortPrizeCards(cards, band.target)
}

async function queryCatalogInBand(band: PrizeCardPriceBand): Promise<GiveawayPrizeCard[]> {
  if (!isSupabaseConfigured()) {
    return mockCardsInBand(band.min, band.max, band.target)
  }

  try {
    const cards = await pricedCatalogMatches(band, GIVEAWAY_PRIZE_CARD_SHOWCASE_LIMIT * 6)
    if (cards.length) return cards
  } catch (error) {
    console.warn("[giveaway-prize-cards] priced catalog query failed:", error)
  }

  return mockCardsInBand(band.min, band.max, band.target)
}

async function priceChartingCardsInBand(
  band: PrizeCardPriceBand,
  limit: number,
  excludeIds: Set<string>,
): Promise<GiveawayPrizeCard[]> {
  if (!process.env.PRICECHARTING_API_KEY || !isSupabaseConfigured()) return []

  const admin = createAdminClient()
  const priceByCardId = await getRawPriceByCardId()

  const { data: slabs, error } = await admin
    .from("slab_cards")
    .select("id, name, set_name, card_number, rarity, image_large, image_small")
    .order("release_date", { ascending: false })
    .limit(GIVEAWAY_PRIZE_CARD_PC_CANDIDATE_POOL)

  if (error) {
    console.warn("[giveaway-prize-cards] slab_cards candidate load failed:", error.message)
    return []
  }

  const candidates = ((slabs ?? []) as SlabCardRow[])
    .filter((slab) => !excludeIds.has(slab.id))
    .sort((a, b) => {
      const pa = priceByCardId.get(a.id) ?? 0
      const pb = priceByCardId.get(b.id) ?? 0
      if (pa > 0 && pb > 0) {
        return Math.abs(pa - band.target) - Math.abs(pb - band.target)
      }
      if (pa > 0) return -1
      if (pb > 0) return 1
      return a.name.localeCompare(b.name)
    })

  const priced = await attachBinderCardPrices(
    candidates.map((slab) => ({
      id: slab.id,
      name: slab.name,
      set: slab.set_name,
      cardNumber: slab.card_number,
    })),
    {
      cachedPrices: priceByCardId,
      limit: GIVEAWAY_PRIZE_CARD_PC_LOOKUP_LIMIT,
      concurrency: 2,
    },
  )

  const cards: GiveawayPrizeCard[] = []
  for (const slab of candidates) {
    const rawPrice = priced.get(slab.id)
    if (!rawPrice || !isWithinPrizeCardBand(rawPrice, band.target)) continue
    const card = slabToPrizeCard(slab, rawPrice)
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

  const cached = dedupePrizeCards(
    (await queryCatalogInBand(band)).filter((card) => isWithinPrizeCardBand(card.rawPrice, band.target)),
    limit,
  )

  if (cached.length >= limit) {
    return { band, cards: cached, usedLivePriceCharting: false }
  }

  const excludeIds = new Set(cached.map((card) => card.id))
  const live = await priceChartingCardsInBand(band, limit - cached.length, excludeIds)
  const merged = dedupePrizeCards([...cached, ...live], limit)

  return {
    band,
    cards: merged,
    usedLivePriceCharting: live.length > 0,
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
