import { NextRequest, NextResponse } from "next/server"
import { resolvePokemonCardImage } from "@/lib/pokemon-tcg"

export const maxDuration = 10

function parseNumberFromName(name: string): string {
  return name.match(/#(\d+[a-zA-Z/-]*)/)?.[1] ?? ""
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const id = params.get("id")?.trim() ?? ""
  const name = params.get("name")?.trim() ?? ""
  const set = params.get("set")?.trim() ?? ""
  const number = params.get("number")?.trim() || parseNumberFromName(name)

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  try {
    const catalog = await resolvePokemonCardImage({
      cardName: name,
      setName: set,
      cardNumber: number,
      pokemonTcgId: id || undefined,
    })

    const image = catalog?.imageLarge ?? catalog?.imageSmall ?? null
    if (!image) {
      return NextResponse.json({ image: null })
    }

    return NextResponse.json(
      {
        image,
        pokemonTcgId: catalog?.id ? `poke-${catalog.id}` : undefined,
      },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    )
  } catch (error) {
    console.error("[binder/card-image] failed:", error)
    return NextResponse.json({ image: null }, { status: 503 })
  }
}
