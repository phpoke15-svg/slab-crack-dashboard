import { getCardPriceById } from "@/lib/pricing/db"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  getLegacyMapByPcId,
  markLegacyMapFailed,
  saveLegacyMapResolution,
} from "@/lib/pricing/card-id-legacy-map"
import { legacyPcIdFromCardId, normalizeLegacyPcId, toPokemonCatalogId } from "@/lib/types/card-id"
import type { CardLanguage, LegacyIdResolution } from "@/lib/types/pokemon-api"
import { tcgGoCardToPokemonCard } from "@/lib/types/pokemon-api-adapters"
import {
  catalogIdFromTcgGoCard,
  pokemonTcgIdFromCardId,
  resolveTcgGoCardForTarget,
} from "@/lib/tcggo-api"
import { cardNumberMatches } from "@/lib/trade-binder/pokemon-tcg"
import { promoCardMeta } from "@/lib/trade-binder/promo-card-meta"

export type ResolveLegacyPcIdInput = {
  legacyCardId: string
  cardName?: string | null
  cardSet?: string | null
  cardNumber?: string | null
}

export type ResolveLegacyPcIdResult =
  | { ok: true; resolution: LegacyIdResolution; cached: boolean }
  | { ok: false; legacyPcId: string; error: string }

function legacyPcIdFromInput(input: ResolveLegacyPcIdInput): string | null {
  const fromId = legacyPcIdFromCardId(input.legacyCardId)
  if (fromId) return fromId
  if (/^\d+$/.test(input.legacyCardId.trim())) return input.legacyCardId.trim()
  return null
}

function parseCardLanguage(value: unknown): CardLanguage {
  return value === "ja" ? "ja" : "en"
}

function setNamesMatch(left: string, right: string): boolean {
  const a = left.toLowerCase().trim()
  const b = right.toLowerCase().trim()
  if (!a || !b || a === "unknown set" || b === "unknown set") return true
  return a.includes(b) || b.includes(a)
}

/** Match an existing poke-* cache row by name/set/number before hitting RapidAPI. */
async function findExistingPokeMappingFromCache(input: {
  cardName: string
  cardSet: string
  cardNumber: string
}): Promise<Omit<LegacyIdResolution, "legacyPcId"> | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("card_prices")
    .select("card_id, tcg_id, tcggo_id, tcgplayer_id, language, card_name, card_set, card_number")
    .like("card_id", "poke-%")
    .ilike("card_name", input.cardName.trim())
    .limit(40)

  if (error?.code === "42P01" || !data?.length) return null
  if (error) throw error

  const targetNumber = input.cardNumber?.split("/")[0]?.replace(/^#/, "").trim()
  const matches = data.filter((row) => {
    if (!setNamesMatch(String(row.card_set ?? ""), input.cardSet)) return false
    if (!targetNumber) return true
    return cardNumberMatches(String(row.card_number ?? ""), targetNumber)
  })

  if (matches.length !== 1) return null

  const row = matches[0]!
  const tcgId = String(row.tcg_id ?? "").trim() || pokemonTcgIdFromCardId(String(row.card_id))
  if (!tcgId) return null

  return {
    newPokeId: String(row.card_id),
    tcgGoId: row.tcggo_id == null ? undefined : Number(row.tcggo_id),
    tcgplayerId: row.tcgplayer_id == null ? undefined : Number(row.tcgplayer_id),
    tcgId,
    language: parseCardLanguage(row.language),
  }
}

async function persistResolution(
  legacyPcId: string,
  resolution: Omit<LegacyIdResolution, "legacyPcId"> & {
    cardName?: string
    cardSet?: string
    cardNumber?: string
  },
): Promise<ResolveLegacyPcIdResult> {
  await saveLegacyMapResolution({
    legacyPcId,
    newPokeId: resolution.newPokeId,
    tcgGoId: resolution.tcgGoId ?? null,
    tcgplayerId: resolution.tcgplayerId ?? null,
    tcgId: resolution.tcgId,
    language: resolution.language,
    cardName: resolution.cardName ?? null,
    cardSet: resolution.cardSet ?? null,
    cardNumber: resolution.cardNumber ?? null,
    status: "resolved",
  })

  return {
    ok: true,
    cached: false,
    resolution: { legacyPcId, ...resolution },
  }
}

/** Resolve a legacy `pc-*` id to `poke-{tcgid}` via cache, mapping table, or live pokemon-api lookup. */
export async function resolveLegacyPcCardId(
  input: ResolveLegacyPcIdInput,
): Promise<ResolveLegacyPcIdResult> {
  const legacyPcId = legacyPcIdFromInput(input)
  if (!legacyPcId) {
    return { ok: false, legacyPcId: input.legacyCardId, error: "Not a legacy PriceCharting id" }
  }

  const existingMap = await getLegacyMapByPcId(legacyPcId)
  if (existingMap?.resolution_status === "resolved" && existingMap.new_poke_id && existingMap.tcg_id) {
    return {
      ok: true,
      cached: true,
      resolution: {
        legacyPcId,
        newPokeId: existingMap.new_poke_id,
        tcgGoId: existingMap.tcggo_id ?? undefined,
        tcgplayerId: existingMap.tcgplayer_id ?? undefined,
        tcgId: existingMap.tcg_id,
        language: existingMap.language ?? "en",
      },
    }
  }

  const legacyCardId = `pc-${legacyPcId}`
  const cachedPrice = await getCardPriceById(legacyCardId)
  const cardName = input.cardName ?? cachedPrice?.card_name ?? "Unknown card"
  const setName = input.cardSet ?? cachedPrice?.card_set ?? "Unknown set"
  const cardNumber = input.cardNumber ?? cachedPrice?.card_number ?? ""
  const meta = promoCardMeta(legacyCardId)

  if (!cardName || cardName === "Unknown card") {
    await markLegacyMapFailed(legacyPcId, "Missing card name metadata for lookup")
    return { ok: false, legacyPcId, error: "Missing card name metadata for lookup" }
  }

  const cachedMapping = await findExistingPokeMappingFromCache({ cardName, cardSet: setName, cardNumber })
  if (cachedMapping) {
    return persistResolution(legacyPcId, {
      ...cachedMapping,
      cardName,
      cardSet: setName,
      cardNumber,
    })
  }

  if (cachedPrice?.tcg_id?.trim()) {
    return persistResolution(legacyPcId, {
      newPokeId: toPokemonCatalogId(cachedPrice.tcg_id),
      tcgGoId: cachedPrice.tcggo_id ?? undefined,
      tcgplayerId: cachedPrice.tcgplayer_id ?? undefined,
      tcgId: cachedPrice.tcg_id.trim(),
      language: cachedPrice.language ?? "en",
      cardName,
      cardSet: setName,
      cardNumber,
    })
  }

  try {
    const tcgCard = await resolveTcgGoCardForTarget({
      cardId: legacyCardId,
      cardName,
      setName,
      cardNumber,
      tcgGoId: meta?.tcgGoId ?? cachedPrice?.tcggo_id ?? undefined,
      tcgplayerId: meta?.tcgplayerId ?? cachedPrice?.tcgplayer_id ?? undefined,
    })

    if (!tcgCard) {
      await markLegacyMapFailed(legacyPcId, "pokemon-api lookup did not match target card")
      return { ok: false, legacyPcId, error: "pokemon-api lookup did not match target card" }
    }

    const pokemonCard = tcgGoCardToPokemonCard(tcgCard)
    const newPokeId = catalogIdFromTcgGoCard(tcgCard)

    return persistResolution(legacyPcId, {
      newPokeId: toPokemonCatalogId(pokemonCard.tcgId) || newPokeId,
      tcgGoId: tcgCard.id,
      tcgplayerId: tcgCard.tcgplayer_id,
      tcgId: pokemonCard.tcgId,
      language: pokemonCard.language,
      cardName: pokemonCard.name,
      cardSet: pokemonCard.setName,
      cardNumber: pokemonCard.number,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "pokemon-api lookup failed"
    await markLegacyMapFailed(legacyPcId, message)
    return { ok: false, legacyPcId, error: message }
  }
}

export function collectLegacyPcIdsFromCardIds(cardIds: string[]): string[] {
  const out = new Set<string>()
  for (const id of cardIds) {
    const legacy = legacyPcIdFromCardId(id)
    if (legacy) out.add(normalizeLegacyPcId(legacy))
  }
  return [...out]
}
