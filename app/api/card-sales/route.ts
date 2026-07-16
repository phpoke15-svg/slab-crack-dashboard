import { NextResponse } from "next/server"
import { findWatchlistCard } from "@/lib/db/watchlist-lookup"
import { fetchRecentSalesForCard } from "@/lib/ebay-sold"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const gradeParam = searchParams.get("grade")

  if (!id || !gradeParam) {
    return NextResponse.json({ error: "id and grade are required" }, { status: 400 })
  }

  const slabGrade = Number(gradeParam)
  if (!Number.isFinite(slabGrade)) {
    return NextResponse.json({ error: "grade must be a number" }, { status: 400 })
  }

  const apiKey = process.env.EBAY_SOLD_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "EBAY_SOLD_API_KEY is not configured" }, { status: 503 })
  }

  const card = await findWatchlistCard(id)
  if (!card) {
    return NextResponse.json({ error: "Card not found in watchlist" }, { status: 404 })
  }

  try {
    const sales = await fetchRecentSalesForCard(apiKey, card, slabGrade)
    return NextResponse.json(sales)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sales"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
