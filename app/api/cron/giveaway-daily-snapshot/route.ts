import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { captureDailyAccountSnapshot } from "@/lib/giveaway/service"

export const dynamic = "force-dynamic"

/** Record today's running total registered accounts (runs daily via Vercel Cron). */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const snap = await captureDailyAccountSnapshot()
    return NextResponse.json({
      ok: true,
      snapshotDate: snap.snapshotDate,
      monthPeriod: snap.monthPeriod,
      accountSnapshot: snap.accountSnapshot,
      prizeArvUsd: snap.prizeArvUsd,
      isMonthEndFinal: snap.isMonthEndFinal ?? false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily snapshot failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
