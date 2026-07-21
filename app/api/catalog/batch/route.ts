import { NextResponse } from "next/server"
import { createCatalogService, isScrydexConfigured } from "@/lib/scrydex"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!isScrydexConfigured()) {
    return NextResponse.json({ error: "Scrydex is not configured" }, { status: 503 })
  }

  let body: { catalogIds?: string[] }
  try {
    body = (await request.json()) as { catalogIds?: string[] }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const catalogIds = [...new Set((body.catalogIds ?? []).map(String).filter(Boolean))].slice(0, 200)
  if (catalogIds.length === 0) {
    return NextResponse.json({ error: "catalogIds required" }, { status: 400 })
  }

  try {
    const service = createCatalogService()
    const cards = await service.getCardsWithPrices(catalogIds)
    return NextResponse.json({ cards, creditsUsed: 0 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch lookup failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
