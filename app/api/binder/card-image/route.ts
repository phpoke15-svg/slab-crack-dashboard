import { NextRequest, NextResponse } from "next/server"
import { resolvePokemonCardImage } from "@/lib/pokemon-tcg"
import { isPlaceholderImage } from "@/lib/card-images"

export const maxDuration = 10

function parseNumberFromName(name: string): string {
  return name.match(/#(\d+[a-zA-Z/-]*)/)?.[1] ?? ""
}

function upgradePriceChartingImageUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes("storage.googleapis.com")) return null
    const match = parsed.pathname.match(/\/([a-z0-9]+)\/(\d+)\.jpg$/i)
    if (!match) return null
    const [, hash, size] = match
    if (Number(size) >= 400) return url
    return `https://storage.googleapis.com/images.pricecharting.com/${hash}/1600.jpg`
  } catch {
    return null
  }
}

function resolveExistingImageUrl(imageUrl?: string): string | null {
  if (!imageUrl || isPlaceholderImage(imageUrl)) return null
  const upgraded = upgradePriceChartingImageUrl(imageUrl)
  if (upgraded) return upgraded
  if (imageUrl.includes("images.pokemontcg.io")) return imageUrl
  if (imageUrl.includes("storage.googleapis.com")) {
    const sizeMatch = imageUrl.match(/\/(\d+)\.jpg(?:\?|$)/)
    if (sizeMatch && Number(sizeMatch[1]) >= 160) return imageUrl
  }
  if (!imageUrl.includes("storage.googleapis.com")) return imageUrl
  return null
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const id = params.get("id")?.trim() ?? ""
  const name = params.get("name")?.trim() ?? ""
  const set = params.get("set")?.trim() ?? ""
  const number = params.get("number")?.trim() || parseNumberFromName(name)
  const imageUrl = params.get("imageUrl")?.trim()

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  try {
    const pokemonTcgId = id.startsWith("poke-") ? id.replace(/^poke-/, "") : undefined

    const catalog = await resolvePokemonCardImage({
      cardName: name,
      setName: set,
      cardNumber: number,
      pokemonTcgId,
    })

    const image =
      catalog?.imageLarge ??
      catalog?.imageSmall ??
      resolveExistingImageUrl(imageUrl) ??
      null

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
    const fallback = resolveExistingImageUrl(imageUrl)
    if (fallback) {
      return NextResponse.json({ image: fallback })
    }
    console.error("[binder/card-image] failed:", error)
    return NextResponse.json({ image: null }, { status: 503 })
  }
}
