import { NextRequest, NextResponse } from "next/server"
import { type ReportReason, submitUserReport } from "@/lib/trade-binder/blocks"
import { notifyUserReport } from "@/lib/ops/report-alert"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

const VALID_REASONS = new Set<ReportReason>([
  "harassment",
  "spam",
  "fraud",
  "inappropriate",
  "other",
])

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const userId = body.userId as string | undefined
  const reason = body.reason as ReportReason | undefined
  const details = (body.details as string | undefined) ?? ""

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })
  if (!reason || !VALID_REASONS.has(reason)) {
    return NextResponse.json({ error: "Valid reason required" }, { status: 400 })
  }
  if (userId === auth.user.id) return NextResponse.json({ error: "Invalid user" }, { status: 400 })

  const { error } = await submitUserReport(
    auth.supabase,
    auth.user.id,
    userId,
    reason,
    details,
  )
  if (error) return NextResponse.json({ error }, { status: 400 })

  void notifyUserReport({
    reporterId: auth.user.id,
    reportedId: userId,
    reason,
    details,
  })

  return NextResponse.json({ ok: true })
}
