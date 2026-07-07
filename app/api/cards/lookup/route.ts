import { NextResponse } from "next/server"
import { lookupCardById, lookupCardByPokemonId } from "@/lib/card-lookup"
import { resolveCardArtwork } from "@/lib/card-images"
import { resolvePokemonCardImage } from "@/lib/pokemon-tcg"
import { bestKnownImageUrl, cardImageNeedsUpgrade } from "@/lib/card-image-url"

export const dynamic = "force-dynamic"

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

    if (cardImageNeedsUpgrade(card.imageUrl)) {
      const synced = bestKnownImageUrl(card.imageUrl)
      if (synced && !cardImageNeedsUpgrade(synced)) {
        card.imageUrl = synced
      } else {
        const pcId = id?.startsWith("pc-") ? id.replace(/^pc-/, "") : undefined
        const artwork = await Promise.race([
          resolveCardArtwork({
            cardName: card.cardName,
            setName: card.setName,
            cardNumber: card.cardNumber,
            imageUrl: card.imageUrl,
            pricechartingId: pcId,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
        ])

        if (artwork) {
          card.imageUrl = bestKnownImageUrl(artwork) ?? artwork
        } else {
          const resolved = await resolvePokemonCardImage({
            cardName: card.cardName,
            setName: card.setName,
            cardNumber: card.cardNumber,
            pokemonTcgId: pokemonTcgId ?? (id?.startsWith("poke-") ? id.replace(/^poke-/, "") : undefined),
          })
          const image = resolved?.imageLarge ?? resolved?.imageSmall
          if (image) card.imageUrl = bestKnownImageUrl(image) ?? image
        }
      }
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
