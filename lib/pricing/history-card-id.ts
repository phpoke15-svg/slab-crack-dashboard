import { getCatalogCardById } from "@/lib/db/cards-catalog"
import { getCardPriceById } from "@/lib/pricing/db"
import {
  catalogIdFromTcgGoCard,
  pokemonTcgIdFromCardId,
  resolveTcgGoCardForTarget,
} from "@/lib/tcggo-api"
import { promoCardMeta } from "@/lib/trade-binder/promo-card-meta"

function isPokemonTcgId(value: string | null | undefined): value is string {
  const trimmed = value?.trim()
  if (!trimmed) return false
  if (trimmed.startsWith("pc-") || trimmed.startsWith("poke-tcggo-")) return false
  return trimmed.startsWith("poke-") || trimmed.includes("-")
}

/** Prefer catalog tcg id for pokemon-api history when the UI id is a legacy PriceCharting key. */
export function resolveHistoryCardId(cardId: string, pokemonTcgId?: string | null): string {
  const trimmed = cardId.trim()
  if (trimmed.startsWith("poke-")) return trimmed

  const tcg = pokemonTcgId?.trim()
  if (isPokemonTcgId(tcg)) return tcg.startsWith("poke-") ? tcg : `poke-${tcg}`

  return trimmed
}

/** Resolve tcg id for history fetch — falls back to name/set lookup for pc- cards. */
export async function resolveHistoryCardIdAsync(
  cardId: string,
  pokemonTcgId?: string | null,
): Promise<string> {
  const basic = resolveHistoryCardId(cardId, pokemonTcgId)
  if (basic.startsWith("poke-")) return basic

  const catalog = await getCatalogCardById(basic)
  if (catalog?.id.startsWith("poke-")) return catalog.id

  const cached = await getCardPriceById(basic)
  if (cached?.card_name && cached.card_set) {
    const meta = promoCardMeta(basic)
    const resolved = await resolveTcgGoCardForTarget({
      cardId: basic,
      cardName: cached.card_name,
      setName: cached.card_set,
      cardNumber: cached.card_number ?? "",
      tcgGoId: meta?.tcgGoId,
      tcgplayerId: meta?.tcgplayerId,
    })
    if (resolved) return catalogIdFromTcgGoCard(resolved)
  }

  const bareTcgId = pokemonTcgIdFromCardId(basic)
  if (bareTcgId) return `poke-${bareTcgId}`

  return basic
}
