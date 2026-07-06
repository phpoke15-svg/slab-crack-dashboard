import { NextResponse } from "next/server"
import { syncAnomalies } from "@/lib/sync-anomalies"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
