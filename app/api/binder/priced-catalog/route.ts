import { NextRequest, NextResponse } from "next/server"
import { getPricedCatalogCards } from "@/lib/db/priced-catalog"
import { filterPricedCatalog } from "@/lib/trade-binder/priced-catalog"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 60), 200)
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") ?? 0), 0)

  try {
    const all = await getPricedCatalogCards()
    const filtered = filterPricedCatalog(all, q)
    const page = filtered.slice(offset, offset + limit)

    return NextResponse.json({
      cards: page,
      total: filtered.length,
      offset,
      limit,
      languageFilter: "english-japanese",
    })
  } catch {
    return NextResponse.json({ error: "Could not load priced catalog" }, { status: 503 })
  }
}
