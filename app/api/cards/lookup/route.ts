import { NextResponse } from "next/server"
import { lookupCardById, lookupCardByPokemonId } from "@/lib/card-lookup"
import { resolvePokemonCardImage } from "@/lib/pokemon-tcg"

export const dynamic = "force-dynamic"

function isLowResImage(url: string): boolean {
  if (!url || url.includes("placeholder")) return true
  if (url.includes("placehold.co")) return true
  if (/images\.pricecharting\.com\/[^/]+\/(60|160)\.jpg/i.test(url)) return true
  if (url.includes("storage.googleapis.com") && /\/(60|160)\.jpg(?:\?|$)/.test(url)) return true
  return false
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim()
  const pokemonTcgId = searchParams.get("pokemonTcgId")?.trim()
  const cardName = searchParams.get("cardName")?.trim()
  const setName = searchParams.get("setName")?.trim()
  const cardNumber = searchParams.get("cardNumber")?.trim()
  const imageUrl = searchParams.get("imageUrl")?.trim()

  if (!id && !pokemonTcgId) {
    return NextResponse.json({ error: "id or pokemonTcgId is required" }, { status: 400 })
  }

  const catalogContext =
    pokemonTcgId && cardName && setName
      ? {
          cardName,
          setName,
          cardNumber: cardNumber ?? "",
          imageUrl: imageUrl || undefined,
        }
      : undefined

  try {
    const card = id
      ? await lookupCardById(id)
      : await lookupCardByPokemonId(pokemonTcgId!, catalogContext)

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    if (isLowResImage(card.imageUrl)) {
      const resolved = await resolvePokemonCardImage({
        cardName: card.cardName,
        setName: card.setName,
        cardNumber: card.cardNumber,
        pokemonTcgId: pokemonTcgId ?? (id?.startsWith("poke-") ? id : undefined),
      })
      const image = resolved?.imageLarge ?? resolved?.imageSmall
      if (image) card.imageUrl = image
    }

    return NextResponse.json(card, {
      headers: {
        "Cache-Control": "private, max-age=900, stale-while-revalidate=1800",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
