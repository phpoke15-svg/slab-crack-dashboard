import { NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { removePushSubscription, upsertPushSubscription } from "@/lib/push/web-push"

export const dynamic = "force-dynamic"

type Body = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
  queueLive?: boolean
  walmartWednesday?: boolean
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

  let userId: string | null = null
  try {
    const authResult = await requireUser()
    if (authResult.ok) userId = authResult.user.id
  } catch {
    // anonymous subscriptions allowed
  }

  await upsertPushSubscription({
    endpoint,
    p256dh,
    auth,
    userId,
    queueLive: body.queueLive !== false,
    walmartWednesday: body.walmartWednesday !== false,
    userAgent: request.headers.get("user-agent"),
  })

  return NextResponse.json({ ok: true })
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
