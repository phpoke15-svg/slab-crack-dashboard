import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { RESTOCKS_ENABLED } from "@/lib/collectools-tools"
import { sendWalmartWednesdayReminder } from "@/lib/restocks/wednesday-reminder"

export const dynamic = "force-dynamic"
export const maxDuration = 15

/**
 * Weekly heads-up: Walmart Pokémon sealed restocks are typically Wed 9pm ET.
 * Cron is UTC — we register both DST offsets; the handler only sends in the ET window
 * (or when ?force=1 for manual tests).
 * No-ops while Restocks is hub-hidden unless ?force=1.
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const force = new URL(request.url).searchParams.get("force") === "1"
  if (!RESTOCKS_ENABLED && !force) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "RESTOCKS_ENABLED is false — pass ?force=1 to send anyway",
      time: new Date().toISOString(),
    })
  }

  try {
    const result = await sendWalmartWednesdayReminder({ force })
    return NextResponse.json({ ok: true, ...result, time: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Reminder failed" },
      { status: 500 },
    )
  }
}
