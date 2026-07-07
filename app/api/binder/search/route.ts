import { NextRequest, NextResponse } from "next/server"
import { buildPokemonSearchQuery, toCatalogCard, type PokemonApiCard } from "@/lib/trade-binder/pokemon-tcg"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ cards: [], totalCount: 0 })
  }

  const pageSize = Math.min(Number(request.nextUrl.searchParams.get("pageSize") ?? 20), 40)
  const url = new URL("https://api.pokemontcg.io/v2/cards")
  url.searchParams.set("q", buildPokemonSearchQuery(q))
  url.searchParams.set("pageSize", String(pageSize))
  url.searchParams.set("orderBy", "-set.releaseDate")

  const headers: HeadersInit = { Accept: "application/json" }
  const apiKey = process.env.POKEMON_TCG_API_KEY
  if (apiKey) headers["X-Api-Key"] = apiKey

  try {
    const res = await fetch(url, { headers, next: { revalidate: 300 } })
    if (!res.ok) {
      return NextResponse.json({ error: "Search failed" }, { status: res.status })
    }

    const data = await res.json()
    const cards = (data.data as PokemonApiCard[]).map(toCatalogCard)
    return NextResponse.json({ cards, totalCount: data.totalCount ?? cards.length })
  } catch {
    return NextResponse.json({ error: "Search unavailable" }, { status: 503 })
  }
}
