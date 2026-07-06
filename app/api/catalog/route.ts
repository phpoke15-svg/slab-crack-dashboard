import { NextResponse } from "next/server"
import mockData from "@/lib/mockData.json"
import { getCatalogFeedFromDb, isSupabaseConfigured } from "@/lib/db/catalog-feed"
import { normalizeCardEntry, type MockCardEntry } from "@/lib/slab-data"

export async function GET() {
  if (isSupabaseConfigured()) {
    try {
      const feed = await getCatalogFeedFromDb()
      if (feed.length > 0) {
        return NextResponse.json(feed)
      }
    } catch (error) {
      console.error("[catalog] Supabase read failed, falling back to mock data:", error)
    }
  }

  return NextResponse.json((mockData as MockCardEntry[]).map(normalizeCardEntry))
}
