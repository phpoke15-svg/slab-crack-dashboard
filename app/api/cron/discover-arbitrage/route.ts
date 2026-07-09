import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { discoverArbitrageFromMarket } from "@/lib/discover-arbitrage"

export const maxDuration = 10
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const result = await discoverArbitrageFromMarket()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
