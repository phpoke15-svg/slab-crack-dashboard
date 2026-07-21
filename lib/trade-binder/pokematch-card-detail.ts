import type { PokeMatchCardDetailPayload } from "@/lib/trade-binder/pokematch-card-full"

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

export function pokematchCardFromDetail(payload: PokeMatchCardDetailPayload): PokeMatchCardDetailInput {
  return {
    id: payload.id,
    name: payload.name,
    set: payload.setName,
    image: payload.imageUrl,
    cardNumber: payload.cardNumber,
    rawPrice: payload.rawPrice > 0 ? payload.rawPrice : undefined,
  }
}
