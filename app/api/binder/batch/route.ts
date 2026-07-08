import { NextRequest, NextResponse } from "next/server"
import { lookupCatalogCardsByIds } from "@/lib/trade-binder/catalog-batch"

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids")?.trim()
  if (!idsParam) {
    return NextResponse.json({ cards: [] })
  }

  const ids = idsParam.split(",").filter(Boolean).slice(0, 50)
  if (ids.length === 0) {
    return NextResponse.json({ cards: [] })
  }

  try {
    const cards = await lookupCatalogCardsByIds(ids)
    return NextResponse.json({ cards })
  } catch {
    return NextResponse.json({ error: "Card lookup unavailable" }, { status: 503 })
  }
}
