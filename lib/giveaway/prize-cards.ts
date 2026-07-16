import mockData from "@/lib/mockData.json"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import {
  GIVEAWAY_PRIZE_CARD_BAND_PERCENT,
  GIVEAWAY_PRIZE_CARD_SHOWCASE_LIMIT,
} from "@/lib/giveaway/constants"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { MockCardEntry } from "@/lib/slab-data"
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

function roundUsd(amount: number): number {
  return Math.round(amount * 100) / 100
}

/** Symmetric price band around a target ARV (widens for very small prizes). */
export function prizeCardPriceBand(
  targetUsd: number,
  bandPercent = GIVEAWAY_PRIZE_CARD_BAND_PERCENT,
): PrizeCardPriceBand {
  const target = roundUsd(Math.max(0, targetUsd))
  if (target <= 0) return { min: 0, max: 0, target: 0 }

  const padding = Math.max(target * bandPercent, 0.5)
  return {
    target,
    min: roundUsd(Math.max(0.01, target - padding)),
    max: roundUsd(target + padding),
  }
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

type BinderPriceRow = {
  card_id: string
  raw_price: number
  card_name: string
  card_set: string
  card_number: string
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
  const { data, error } = await admin
    .from("slab_cards")
    .select("id, name, set_name, card_number, rarity, image_large, image_small")
    .in("id", cardIds)

  if (error) throw error

  const byId = new Map<string, SlabCardRow>()
  for (const row of (data ?? []) as SlabCardRow[]) {
    byId.set(row.id, row)
  }
  return byId
}

function binderRowToPrizeCard(
  row: BinderPriceRow,
  slab: SlabCardRow | undefined,
): GiveawayPrizeCard | null {
  const setName = slab?.set_name || row.card_set
  const name = slab?.name || row.card_name
  if (!isEnglishOrJapanesePricedCard({ setName, productName: name })) return null

  const image = upgradeCardImageUrlSync(slab?.image_large ?? slab?.image_small ?? "/placeholder.svg")
  const rarity = slab?.rarity
  const displayName = rarity && !name.toLowerCase().includes(rarity.toLowerCase())
    ? `${name} (${rarity})`
    : name

  return {
    id: row.card_id,
    name: displayName,
    set: setName,
    cardNumber: slab?.card_number || row.card_number || undefined,
    image,
    rawPrice: Number(row.raw_price),
  }
}

async function queryCatalogInBand(
  min: number,
  max: number,
  target: number,
): Promise<GiveawayPrizeCard[]> {
  if (!isSupabaseConfigured()) return mockCardsInBand(min, max, target)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("binder_card_prices")
    .select("card_id, raw_price, card_name, card_set, card_number")
    .gte("raw_price", min)
    .lte("raw_price", max)
    .limit(400)

  if (error) throw error

  const rows = (data ?? []) as BinderPriceRow[]
  if (!rows.length) return mockCardsInBand(min, max, target)

  const slabById = await fetchSlabCardsById(rows.map((row) => row.card_id))
  const cards: GiveawayPrizeCard[] = []

  for (const row of rows) {
    const card = binderRowToPrizeCard(row, slabById.get(row.card_id))
    if (card) cards.push(card)
  }

  return sortPrizeCards(cards, target)
}

const WIDEN_BAND_STEPS = [
  GIVEAWAY_PRIZE_CARD_BAND_PERCENT,
  0.25,
  0.4,
  0.65,
] as const

/** Cards from the priced catalog closest to today's prize ARV. */
export async function getGiveawayPrizeCards(
  targetUsd: number,
  limit = GIVEAWAY_PRIZE_CARD_SHOWCASE_LIMIT,
): Promise<{ band: PrizeCardPriceBand; cards: GiveawayPrizeCard[] }> {
  const target = roundUsd(Math.max(0, targetUsd))
  if (target <= 0) {
    return { band: { min: 0, max: 0, target: 0 }, cards: [] }
  }

  let band = prizeCardPriceBand(target)
  let cards: GiveawayPrizeCard[] = []

  for (const step of WIDEN_BAND_STEPS) {
    band = prizeCardPriceBand(target, step)
    cards = await queryCatalogInBand(band.min, band.max, target)
    if (cards.length >= limit) break
  }

  const seen = new Set<string>()
  const unique: GiveawayPrizeCard[] = []
  for (const card of cards) {
    if (seen.has(card.id)) continue
    seen.add(card.id)
    unique.push(card)
    if (unique.length >= limit) break
  }

  return { band, cards: unique }
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
      .filter((card) => card.rawPrice >= band.min && card.rawPrice <= band.max)
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
