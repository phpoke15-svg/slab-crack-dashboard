import "server-only"
import { catalogToSearchHit, type CardSearchHit } from "@/lib/card-lookup"
import {
  dHashFromHex,
  hammingDistance,
  PHASH_MATCH_MAX_DISTANCE,
} from "@/lib/scanner/phash"
import { matchDetectedCardLocal } from "@/lib/slabcrack/local-match"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"

export type VisualMatchResult = {
  hit: CardSearchHit
  distance: number
  confidence: number
}

type PhashRow = {
  id: string
  name: string
  set_name: string
  card_number: string
  rarity: string | null
  image_large: string | null
  image_small: string | null
  phash: string | null
}

function rowToHit(row: PhashRow): CardSearchHit {
  return catalogToSearchHit({
    id: row.id,
    name: row.name,
    setName: row.set_name,
    cardNumber: row.card_number,
    rarity: row.rarity,
    imageSmall: row.image_small,
    imageLarge: row.image_large,
  })
}

/**
 * Find nearest catalog card by perceptual hash (requires `phash` column on slab_cards).
 */
export async function matchCardByPhash(
  phashHex: string,
): Promise<VisualMatchResult | null> {
  if (!isSupabaseConfigured() || !phashHex?.trim()) return null

  const queryHash = dHashFromHex(phashHex)
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("slab_cards")
    .select("id, name, set_name, card_number, rarity, image_large, image_small, phash")
    .not("phash", "is", null)
    .limit(5000)

  if (error) {
    if (error.message.includes("phash")) return null
    throw new Error(error.message)
  }

  const rows = (data ?? []) as PhashRow[]
  if (!rows.length) return null

  let best: { row: PhashRow; distance: number } | null = null
  for (const row of rows) {
    if (!row.phash) continue
    const distance = hammingDistance(queryHash, dHashFromHex(row.phash))
    if (distance > PHASH_MATCH_MAX_DISTANCE) continue
    if (!best || distance < best.distance) best = { row, distance }
  }

  if (!best) return null

  const confidence = Math.round((1 - best.distance / 64) * 100)
  return {
    hit: rowToHit(best.row),
    distance: best.distance,
    confidence,
  }
}

/** Turn a visual hash hit into a priced card via local cache. */
export async function priceVisualMatch(visual: VisualMatchResult) {
  const detected = {
    cardName: visual.hit.cardName,
    setName: visual.hit.setName,
    cardNumber: visual.hit.cardNumber,
    confidence: visual.confidence / 100,
    notes: `Visual match (dHash distance ${visual.distance})`,
  }

  const local = await matchDetectedCardLocal(detected)
  if (local?.card) {
    return {
      detected,
      hit: visual.hit,
      card: local.card,
      candidates: local.candidates,
      matchScore: Math.max(local.matchScore, 80 - visual.distance * 2),
      needsLiveRefresh: local.needsLiveRefresh,
    }
  }

  return {
    detected,
    hit: visual.hit,
    card: null,
    candidates: [visual.hit],
    matchScore: 80 - visual.distance * 2,
    needsLiveRefresh: true,
  }
}
