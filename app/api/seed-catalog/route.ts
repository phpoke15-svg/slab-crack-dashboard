import { NextResponse } from "next/server"
import { seedCatalogFromWatchlist } from "@/lib/db/catalog"

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const results = await seedCatalogFromWatchlist()
    return NextResponse.json({ seeded: results.length, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seed failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
