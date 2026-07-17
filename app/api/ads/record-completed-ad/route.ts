import { NextResponse } from "next/server"
import { isAdRewardDevBypassEnabled, verifyGoogleAdSsv } from "@/lib/ads/verify-google-ad-ssv"
import { requireGiveawayAccess } from "@/lib/giveaway/access"
import { recordCompletedAd } from "@/lib/giveaway/ad-rewards"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

async function getUserPlan(userId: string): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin.from("profiles").select("plan").eq("id", userId).maybeSingle()
  return (data?.plan as string | undefined) ?? "free"
}

/** Google AdMob / Ad Manager server-side verification (SSV) callback. */
export async function GET(request: Request) {
  const url = new URL(request.url)

  let userId: string | null = null
  let transactionId: string | null = null

  if (isAdRewardDevBypassEnabled() && url.searchParams.get("user_id")) {
    userId = url.searchParams.get("user_id")!.trim()
    transactionId = url.searchParams.get("transaction_id")
  } else {
    const verified = await verifyGoogleAdSsv(url)
    if (!verified.ok || !verified.userId) {
      return NextResponse.json({ ok: false, error: verified.error ?? "SSV verification failed" }, { status: 403 })
    }
    userId = verified.userId
    transactionId = verified.transactionId ?? null
  }

  try {
    const plan = await getUserPlan(userId)
    const result = await recordCompletedAd(userId, { transactionId, plan })
    const status = result.ok ? 200 : result.reason === "daily_ad_limit_reached" ? 429 : 400
    return NextResponse.json({ ok: result.ok, ...result }, { status })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record ad reward"
    const httpStatus = /not set up yet|not configured/i.test(message) ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status: httpStatus })
  }
}

type PostBody = {
  transactionId?: string
}

/**
 * Authenticated fallback after GPT/AdMob rewardedSlotGranted on the client.
 * Production should also configure Google SSV to hit GET on this route.
 */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const access = await requireGiveawayAccess(auth.user.id)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  let body: PostBody = {}
  try {
    const raw = await request.text()
    if (raw.trim()) body = JSON.parse(raw) as PostBody
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    const plan = await getUserPlan(auth.user.id)
    const result = await recordCompletedAd(auth.user.id, {
      transactionId: body.transactionId?.trim() || null,
      plan,
    })
    const status = result.ok ? 200 : result.reason === "daily_ad_limit_reached" ? 429 : 400
    return NextResponse.json({ ok: result.ok, ...result }, { status })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record ad reward"
    const httpStatus = /not set up yet|not configured/i.test(message) ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status: httpStatus })
  }
}
