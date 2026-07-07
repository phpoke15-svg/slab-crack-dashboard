import { NextRequest, NextResponse } from "next/server"
import { resolvePokemonCardImage } from "@/lib/pokemon-tcg"
import { mapPokemonRarity } from "@/lib/trade-binder/pokemon-tcg"

export const maxDuration = 60

type EnrichInput = {
  id: string
  name: string
  set: string
  image?: string
  rarity?: string
  cardNumber?: string
}

function needsImage(image?: string): boolean {
  if (!image?.trim()) return true
  return image.includes("placeholder")
}

export async function POST(request: NextRequest) {
  let cards: EnrichInput[] = []

  try {
    const body = (await request.json()) as { cards?: EnrichInput[] }
    cards = body.cards ?? []
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const toEnrich = cards.filter((card) => needsImage(card.image)).slice(0, 50)
  if (toEnrich.length === 0) {
    return NextResponse.json({ cards })
  }

  const enrichedById = new Map<string, EnrichInput>()

  await Promise.all(
    toEnrich.map(async (card) => {
      const resolved = await resolvePokemonCardImage({
        cardName: card.name,
        setName: card.set,
        cardNumber: card.cardNumber ?? "",
        pokemonTcgId: card.id,
      })

      const image = resolved?.imageLarge ?? resolved?.imageSmall
      if (!image) return

      enrichedById.set(card.id, {
        ...card,
        image,
        rarity: card.rarity ?? mapPokemonRarity(resolved.rarity ?? undefined),
      })
    }),
  )

  const merged = cards.map((card) => enrichedById.get(card.id) ?? card)
  return NextResponse.json({ cards: merged })
}
