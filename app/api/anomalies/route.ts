import { NextResponse } from "next/server"
import { getCatalogFeedFromDb, isSupabaseConfigured } from "@/lib/db/catalog-feed"
import { readAnomaliesCache } from "@/lib/sync-anomalies"
import mockData from "@/lib/mockData.json"
import { normalizeCardEntry, type MockCardEntry } from "@/lib/slab-data"

export async function GET() {
  if (isSupabaseConfigured()) {
    try {
      const feed = await getCatalogFeedFromDb()
      if (feed.length > 0) {
        return NextResponse.json(feed)
      }
    } catch (error) {
      console.error("[anomalies] Supabase read failed, falling back to cache:", error)
    }
  }

  const cached = await readAnomaliesCache()
  if (cached.length > 0) return NextResponse.json(cached.map(normalizeCardEntry))

  return NextResponse.json((mockData as MockCardEntry[]).map(normalizeCardEntry))
}
