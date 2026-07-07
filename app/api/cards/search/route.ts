import { NextResponse } from "next/server"
import { searchCatalogCards } from "@/lib/card-lookup"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""

  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const results = await searchCatalogCards(q, 12)
    return NextResponse.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed"
    return NextResponse.json({ error: message, results: [] }, { status: 500 })
  }
}
