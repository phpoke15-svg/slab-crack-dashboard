import { NextResponse } from "next/server"
import { syncBinderCardPrices } from "@/lib/sync-binder-prices"

export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await syncBinderCardPrices()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Binder price sync failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
