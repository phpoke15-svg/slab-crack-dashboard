import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { seedCatalogFromWatchlist } from "@/lib/db/catalog"

export async function POST(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const results = await seedCatalogFromWatchlist()
    return NextResponse.json({ seeded: results.length, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seed failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
