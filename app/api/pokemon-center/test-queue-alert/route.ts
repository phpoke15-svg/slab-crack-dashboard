import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { sendTestQueueLiveWebPush } from "@/lib/pokemon-center/queue-alerts"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * POST /api/pokemon-center/test-queue-alert — send a test queue-live web push
 * to Pro/Supreme subscribers on /pokewatch. Requires CRON_SECRET Bearer auth.
 * Pass ?force=1 to bypass the 5-minute dedupe window.
 */
export async function POST(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const force =
    new URL(request.url).searchParams.get("force") === "1" ||
    new URL(request.url).searchParams.get("force") === "true"

  try {
    const result = await sendTestQueueLiveWebPush({ force })
    return NextResponse.json({
      ok: true,
      test: true,
      force,
      ...result,
      time: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Test queue alert failed",
      },
      { status: 500 },
    )
  }
}
