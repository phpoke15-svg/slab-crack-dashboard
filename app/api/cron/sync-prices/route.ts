import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { syncAnomalies } from "@/lib/sync-anomalies"

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const result = await syncAnomalies()
    for (const alert of result.alerts) {
      console.log(alert)
    }
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
