import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { sendGiveawayEntryReminders } from "@/lib/giveaway/reminder-push"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/** Remind opted-in users to earn today's giveaway entry (daily cron). */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const result = await sendGiveawayEntryReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Giveaway reminders failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
