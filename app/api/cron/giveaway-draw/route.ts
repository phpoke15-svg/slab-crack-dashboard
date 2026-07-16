import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { drawMonthlyWinner } from "@/lib/giveaway/service"
import { monthPeriod } from "@/lib/giveaway/constants"

export const dynamic = "force-dynamic"

/** Draw winner for the previous calendar month (runs on 1st of each month via Vercel Cron). */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const url = new URL(request.url)
  const override = url.searchParams.get("month")?.trim()

  let targetMonth = override
  if (!targetMonth) {
    const now = new Date()
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    targetMonth = monthPeriod(prev)
  }

  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    return NextResponse.json({ ok: false, error: "Invalid month (use YYYY-MM)" }, { status: 400 })
  }

  try {
    const result = await drawMonthlyWinner(targetMonth)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draw failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
