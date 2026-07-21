import { getCardPriceById } from "@/lib/pricing/db"
import {
  getLegacyMapByPcId,
  markLegacyMapFailed,
  saveLegacyMapResolution,
} from "@/lib/pricing/card-id-legacy-map"
import { legacyPcIdFromCardId, normalizeLegacyPcId, toPokemonCatalogId } from "@/lib/types/card-id"
import type { LegacyIdResolution } from "@/lib/types/pokemon-api"
import { tcgGoCardToPokemonCard } from "@/lib/types/pokemon-api-adapters"
import {
  catalogIdFromTcgGoCard,
  resolveTcgGoCardForTarget,
  tcgGoCardMatchesTarget,
} from "@/lib/tcggo-api"
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
        newPokeId: toPokemonCatalogId(existingMap.tcg_id),
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

  try {
    const tcgCard = await resolveTcgGoCardForTarget({
      cardId: legacyCardId,
      cardName,
      setName,
      cardNumber,
      tcgGoId: meta?.tcgGoId,
      tcgplayerId: meta?.tcgplayerId,
    })

    if (!tcgCard || !tcgGoCardMatchesTarget(tcgCard, { cardName, cardNumber })) {
      await markLegacyMapFailed(legacyPcId, "pokemon-api lookup did not match target card")
      return { ok: false, legacyPcId, error: "pokemon-api lookup did not match target card" }
    }

    const pokemonCard = tcgGoCardToPokemonCard(tcgCard)
    const newPokeId = catalogIdFromTcgGoCard(tcgCard)

    await saveLegacyMapResolution({
      legacyPcId,
      newPokeId,
      tcgGoId: tcgCard.id ?? null,
      tcgplayerId: tcgCard.tcgplayer_id ?? null,
      tcgId: pokemonCard.tcgId,
      language: pokemonCard.language,
      cardName: pokemonCard.name,
      cardSet: pokemonCard.setName,
      cardNumber: pokemonCard.number,
      status: "resolved",
    })

    return {
      ok: true,
      cached: false,
      resolution: {
        legacyPcId,
        newPokeId: toPokemonCatalogId(pokemonCard.tcgId),
        tcgGoId: tcgCard.id,
        tcgplayerId: tcgCard.tcgplayer_id,
        tcgId: pokemonCard.tcgId,
        language: pokemonCard.language,
      },
    }
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
