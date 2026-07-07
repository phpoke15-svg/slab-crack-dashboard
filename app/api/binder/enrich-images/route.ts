import { NextRequest, NextResponse } from "next/server"
import { attachBinderCardImages, cardNeedsImage } from "@/lib/trade-binder/resolve-binder-image"

export const maxDuration = 10

type EnrichInput = {
  id: string
  name: string
  set: string
  image?: string
  rarity?: string
  cardNumber?: string
}

export async function POST(request: NextRequest) {
  let cards: EnrichInput[] = []

  try {
    const body = (await request.json()) as { cards?: EnrichInput[] }
    cards = body.cards ?? []
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const toEnrich = cards
    .filter((card) => cardNeedsImage(card.image))
    .map((card) => ({
      id: card.id,
      name: card.name,
      set: card.set,
      image: card.image ?? "/placeholder.svg",
      cardNumber: card.cardNumber,
    }))

  if (toEnrich.length === 0) {
    return NextResponse.json({ cards })
  }

  const enriched = await attachBinderCardImages(toEnrich, 24)
  const imageById = new Map(enriched.map((card) => [card.id, card.image]))

  const merged = cards.map((card) => {
    const image = imageById.get(card.id)
    return image ? { ...card, image } : card
  })

  return NextResponse.json({ cards: merged })
}
