import { NextResponse } from "next/server"
import watchlistConfig from "@/lib/watchlist-config.json"
import { getWatchlistFromDb } from "@/lib/db/watchlist"
import { fetchRecentSalesForCard } from "@/lib/ebay-sold"
import { normalizeGradingCompany } from "@/lib/grading/types"
import { isSupabaseConfigured } from "@/lib/supabase/server"
import type { WatchlistCard } from "@/lib/sync-anomalies"

async function findWatchlistCard(id: string): Promise<WatchlistCard | undefined> {
  if (isSupabaseConfigured()) {
    try {
      const list = await getWatchlistFromDb()
      const match = list.find((c) => c.id === id)
      if (match) return match
    } catch (error) {
      console.error("[card-sales] DB watchlist lookup failed:", error)
    }
  }

  return (watchlistConfig as WatchlistCard[]).find((c) => c.id === id)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const gradeParam = searchParams.get("grade")
  const company = normalizeGradingCompany(searchParams.get("company"))

  if (!id || !gradeParam) {
    return NextResponse.json({ error: "id and grade are required" }, { status: 400 })
  }

  const slabGrade = gradeParam.trim()
  if (!slabGrade) {
    return NextResponse.json({ error: "grade must be provided" }, { status: 400 })
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
    const sales = await fetchRecentSalesForCard(apiKey, card, slabGrade, company)
    return NextResponse.json({ ...sales, company, grade: slabGrade })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sales"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
