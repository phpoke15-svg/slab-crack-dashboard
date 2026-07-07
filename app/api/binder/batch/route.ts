import { NextRequest, NextResponse } from "next/server"
import { toCatalogCard, type PokemonApiCard } from "@/lib/trade-binder/pokemon-tcg"

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids")?.trim()
  if (!idsParam) {
    return NextResponse.json({ cards: [] })
  }

  const ids = idsParam.split(",").filter(Boolean).slice(0, 50)
  if (ids.length === 0) {
    return NextResponse.json({ cards: [] })
  }

  const query = ids.map((id) => `id:${id}`).join(" OR ")
  const url = new URL("https://api.pokemontcg.io/v2/cards")
  url.searchParams.set("q", query)
  url.searchParams.set("pageSize", String(ids.length))

  const headers: HeadersInit = { Accept: "application/json" }
  const apiKey = process.env.POKEMON_TCG_API_KEY
  if (apiKey) headers["X-Api-Key"] = apiKey

  try {
    const res = await fetch(url, { headers, next: { revalidate: 3600 } })
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch cards" }, { status: res.status })
    }

    const data = await res.json()
    const cards = (data.data as PokemonApiCard[]).map(toCatalogCard)
    return NextResponse.json({ cards })
  } catch {
    return NextResponse.json({ error: "Card lookup unavailable" }, { status: 503 })
  }
}
