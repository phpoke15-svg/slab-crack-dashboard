import { NextResponse } from "next/server"
import { discoverArbitrageFromMarket } from "@/lib/discover-arbitrage"

export const maxDuration = 10
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await discoverArbitrageFromMarket()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
