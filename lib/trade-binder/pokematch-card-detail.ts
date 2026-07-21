import type { TcgResearchCardFull } from "@/lib/tcg-research/card-full"

export type PokeMatchCardDetailInput = {
  id: string
  name: string
  set: string
  image: string
  cardNumber?: string
  rawPrice?: number
}

export function pokematchDetailQuery(card: PokeMatchCardDetailInput): URLSearchParams {
  const params = new URLSearchParams({ id: card.id, game: "pokemon" })
  if (card.cardNumber) params.set("cardNumber", card.cardNumber)
  return params
}

export function pokematchCardFromFull(payload: TcgResearchCardFull): PokeMatchCardDetailInput {
  return {
    id: payload.card.id,
    name: payload.card.cardName,
    set: payload.card.setName,
    image: payload.card.imageUrl,
    cardNumber: payload.card.cardNumber,
    rawPrice: payload.card.rawPrice > 0 ? payload.card.rawPrice : undefined,
  }
}
