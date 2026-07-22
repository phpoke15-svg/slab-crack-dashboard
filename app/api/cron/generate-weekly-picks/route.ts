import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { generateWeeklyPicks } from "@/lib/ai-weekly-picks/generate"
import { parseWeekStartParam } from "@/lib/ai-weekly-picks/week"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Weekly AI pick generator — reads `price_history_daily` (Scrydex daily snapshots). */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const weekStartDate = parseWeekStartParam(searchParams.get("week")) ?? undefined
  const force = searchParams.get("force") === "1" || searchParams.get("force") === "true"

  try {
    const result = await generateWeeklyPicks({ weekStartDate, force })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate weekly picks"
    console.error("[cron/generate-weekly-picks]", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
