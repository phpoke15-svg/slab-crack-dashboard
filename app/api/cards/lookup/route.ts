import { NextResponse } from "next/server"
import { lookupCardById } from "@/lib/card-lookup"
import { lookupCatalogCardEntry } from "@/lib/pricing/catalog-card-lookup"
import { bestKnownImageUrl, cardImageNeedsUpgrade } from "@/lib/card-image-url"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim()
  const pokemonTcgId = searchParams.get("pokemonTcgId")?.trim()

  if (!id && !pokemonTcgId) {
    return NextResponse.json({ error: "id or pokemonTcgId is required" }, { status: 400 })
  }

  const catalogId = id?.startsWith("poke-")
    ? id
    : pokemonTcgId
      ? pokemonTcgId.startsWith("poke-")
        ? pokemonTcgId
        : `poke-${pokemonTcgId}`
      : id

  try {
    let card =
      catalogId?.startsWith("poke-") ? await lookupCatalogCardEntry(catalogId) : null

    if (!card && id) {
      card = await lookupCardById(id)
    }

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    if (cardImageNeedsUpgrade(card.imageUrl)) {
      const synced = bestKnownImageUrl(card.imageUrl)
      if (synced && !cardImageNeedsUpgrade(synced)) {
        card.imageUrl = synced
      }
    }

    return NextResponse.json(card, {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
