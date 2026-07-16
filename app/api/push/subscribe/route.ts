import { NextResponse } from "next/server"
import { isSupremeUser, requireQueueWatchAccess } from "@/lib/billing/stripe"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { removePushSubscription, upsertPushSubscription } from "@/lib/push/web-push"

export const dynamic = "force-dynamic"

type Body = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
  queueLive?: boolean
  walmartWednesday?: boolean
  socialAlerts?: boolean
  priceAlerts?: boolean
  giveawayReminders?: boolean
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const endpoint = body.endpoint?.trim()
  const p256dh = body.keys?.p256dh?.trim()
  const auth = body.keys?.auth?.trim()

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "endpoint and keys required" }, { status: 400 })
  }
  if (endpoint.length > 2048 || p256dh.length > 512 || auth.length > 512) {
    return NextResponse.json({ error: "subscription too large" }, { status: 400 })
  }

  let queueLive = body.queueLive === true
  let walmartWednesday = body.walmartWednesday !== false
  let socialAlerts = body.socialAlerts !== false
  let priceAlerts = body.priceAlerts !== false

  let giveawayReminders = body.giveawayReminders === true

  if (!queueLive && !walmartWednesday && !socialAlerts && !priceAlerts && !giveawayReminders) {
    return NextResponse.json({ error: "Select at least one alert type" }, { status: 400 })
  }

  let userId: string | null = null
  try {
    const authResult = await requireUser()
    if (authResult.ok) userId = authResult.user.id
  } catch {
    // Walmart-only may still work without sign-in
  }

  if (userId && (await isSupremeUser(userId))) {
    queueLive = true
    walmartWednesday = true
    socialAlerts = true
    priceAlerts = true
    giveawayReminders = true
  }

  if (queueLive) {
    if (!userId) {
      return NextResponse.json(
        { error: "Sign in required for Pokémon Center queue alerts.", upgradeUrl: "/pricing" },
        { status: 401 },
      )
    }
    const isPro = await requireQueueWatchAccess(userId)
    if (!isPro) {
      return NextResponse.json(
        {
          error: "Pokémon Center queue alerts require CollecTools Pro.",
          upgradeUrl: "/pricing",
        },
        { status: 403 },
      )
    }
  }

  await upsertPushSubscription({
    endpoint,
    p256dh,
    auth,
    userId,
    queueLive,
    walmartWednesday,
    socialAlerts,
    priceAlerts,
    giveawayReminders,
    userAgent: request.headers.get("user-agent"),
  })

  return NextResponse.json({
    ok: true,
    queueLive,
    walmartWednesday,
    socialAlerts,
    priceAlerts,
    giveawayReminders,
  })
}

export async function DELETE(request: Request) {
  let body: { endpoint?: string }
  try {
    body = (await request.json()) as { endpoint?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const endpoint = body.endpoint?.trim()
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 })
  }

  await removePushSubscription(endpoint)
  return NextResponse.json({ ok: true })
}
