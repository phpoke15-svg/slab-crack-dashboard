/** Known promo / new-set cards missing from pokemon-tcg-data but resolvable via TCGGO. */
export type PromoCardMeta = {
  id: string
  name: string
  setName: string
  setId: string
  number: string
  rarity: string | null
  language: string
  tcgplayerId?: number
  tcgGoId?: number
}

const PROMO_CARD_META: PromoCardMeta[] = [
  {
    id: "poke-mep-41",
    name: "Chimchar",
    setName: "Mega Evolution Black Star Promos",
    setId: "mep",
    number: "41",
    rarity: "Common",
    language: "en",
    tcgplayerId: 684465,
  },
]

const byId = new Map(PROMO_CARD_META.map((card) => [card.id, card]))

export function promoCardMeta(cardId: string): PromoCardMeta | null {
  return byId.get(cardId) ?? null
}

export function promoCardMetaByTcgId(tcgId: string): PromoCardMeta | null {
  const normalized = tcgId.trim().toLowerCase()
  return PROMO_CARD_META.find((card) => card.id === `poke-${normalized}`) ?? null
}

export function allPromoCardMeta(): PromoCardMeta[] {
  return [...PROMO_CARD_META]
}
