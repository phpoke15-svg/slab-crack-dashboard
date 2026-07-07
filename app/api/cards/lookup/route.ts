import { NextResponse } from "next/server"
import { lookupCardById, lookupCardByPokemonId } from "@/lib/card-lookup"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim()
  const pokemonTcgId = searchParams.get("pokemonTcgId")?.trim()

  if (!id && !pokemonTcgId) {
    return NextResponse.json({ error: "id or pokemonTcgId is required" }, { status: 400 })
  }

  try {
    const card = id
      ? await lookupCardById(id)
      : await lookupCardByPokemonId(pokemonTcgId!)

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    return NextResponse.json(card)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
