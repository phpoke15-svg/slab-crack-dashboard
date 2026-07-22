import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { getAppStoreSetupStatus } from "@/lib/app-store-setup"
import { ensureStoreReviewerProAccount } from "@/lib/store-reviewer-setup"
import { isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/app-store-setup — checklist, copy-paste review notes, product IDs.
 * POST — same + create/refresh the shared review Pro account.
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const status = await getAppStoreSetupStatus()
  return NextResponse.json(status)
}

export async function POST(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  try {
    const account = await ensureStoreReviewerProAccount()
    const status = await getAppStoreSetupStatus()
    return NextResponse.json({
      ok: true,
      account,
      ...status,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "App Store setup failed",
      },
      { status: 500 },
    )
  }
}
