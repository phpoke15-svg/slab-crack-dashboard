import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { isSupabaseConfigured } from "@/lib/supabase/server"
import { ensureStoreReviewerProAccount } from "@/lib/store-reviewer-setup"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/setup-store-reviewer
 * Creates (or refreshes) the shared App Store / Play review Pro account.
 * Protected by CRON_SECRET. Safe to re-run.
 */
export async function POST(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  try {
    const result = await ensureStoreReviewerProAccount()
    return NextResponse.json({
      ok: true,
      ...result,
      note: "Use these credentials in App Store Connect and Google Play App Review Information.",
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Setup failed" },
      { status: 500 },
    )
  }
}
