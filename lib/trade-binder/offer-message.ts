export type OfferCard = {
  cardId: string
  cardName: string
  cardSet: string
  cardImage: string
}

export type OfferPayload = {
  v: 1
  note: string
  give: OfferCard[]
  get: OfferCard[]
}

export function encodeOfferMessage(
  note: string,
  give: OfferCard[],
  get: OfferCard[],
): string {
  return JSON.stringify({ v: 1 as const, note, give, get } satisfies OfferPayload)
}

export function parseOfferMessage(body: string): OfferPayload | null {
  if (!body.startsWith("{")) return null
  try {
    const data = JSON.parse(body) as Partial<OfferPayload>
    if (data.v !== 1 || !Array.isArray(data.give) || !Array.isArray(data.get)) return null
    return { v: 1, note: data.note ?? "", give: data.give, get: data.get }
  } catch {
    return null
  }
}
