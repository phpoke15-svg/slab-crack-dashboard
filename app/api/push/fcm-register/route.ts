import { NextResponse } from "next/server"
import { requireQueueWatchAccess } from "@/lib/billing/stripe"
import { verifyQueueWatchToken } from "@/lib/billing/queue-watch-token"
import {
  getFcmTopic,
  isFcmAdminConfigured,
  subscribeDeviceTokenToQueueTopic,
} from "@/lib/push/fcm-admin"
import { upsertFcmDeviceToken } from "@/lib/push/fcm-tokens"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

type Body = {
  deviceToken?: string
  queueWatchToken?: string
  platform?: string
}

async function resolveProUserId(body: Body, request: Request): Promise<string | null> {
  const queueWatchToken = body.queueWatchToken?.trim()
  if (queueWatchToken) {
    const userId = verifyQueueWatchToken(queueWatchToken)
    if (userId && (await requireQueueWatchAccess(userId))) return userId
  }

  try {
    const auth = await requireUser()
    if (auth.ok && (await requireQueueWatchAccess(auth.user.id))) {
      return auth.user.id
    }
  } catch {
    // unauthenticated
  }

  const headerToken =
    request.headers.get("x-queue-watch-token")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    ""

  if (headerToken) {
    const userId = verifyQueueWatchToken(headerToken)
    if (userId && (await requireQueueWatchAccess(userId))) return userId
  }

  return null
}

/**
 * POST /api/push/fcm-register — subscribe a native iOS/Android device token
 * to the queue-live FCM topic (Pro / Supreme only).
 */
export async function POST(request: Request) {
  if (!isFcmAdminConfigured()) {
    return NextResponse.json(
      { error: "FCM is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON on Vercel." },
      { status: 503 },
    )
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const deviceToken = body.deviceToken?.trim()
  if (!deviceToken || deviceToken.length > 4096) {
    return NextResponse.json({ error: "deviceToken required" }, { status: 400 })
  }

  if (deviceToken.startsWith("ExponentPushToken") || deviceToken.startsWith("ExpoPushToken")) {
    return NextResponse.json(
      {
        error:
          "Received an Expo push token, not a native FCM/APNs token. Rebuild the app with google-services.json (Android) and GoogleService-Info.plist (iOS) from Firebase project collectools-28131.",
      },
      { status: 400 },
    )
  }

  const userId = await resolveProUserId(body, request)
  if (!userId) {
    return NextResponse.json(
      { error: "PokeWatch push requires a Pro subscription.", upgradeUrl: "/pricing" },
      { status: 403 },
    )
  }

  try {
    const topic = getFcmTopic()
    const subscribe = await subscribeDeviceTokenToQueueTopic(deviceToken, topic)
    await upsertFcmDeviceToken({
      userId,
      deviceToken,
      platform: body.platform?.trim() || request.headers.get("x-device-platform"),
      topic,
    })

    return NextResponse.json({
      ok: true,
      topic,
      userId,
      subscribe,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "FCM subscribe failed"
    console.error("[push/fcm-register]", message, { userId, tokenPrefix: deviceToken.slice(0, 12) })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
