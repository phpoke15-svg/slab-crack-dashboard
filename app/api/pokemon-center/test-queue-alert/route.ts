import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { POKEMON_CENTER_HOME_URL } from "@/lib/pokemon-center/constants"
import { sendTestQueueLiveWebPush } from "@/lib/pokemon-center/queue-alerts"
import {
  isFcmAdminConfigured,
  sendQueueLiveToDeviceTokens,
  sendTestQueueLiveFcmTopicAlert,
} from "@/lib/push/fcm-admin"
import { countFcmDeviceTokens, listFcmDeviceTokens } from "@/lib/push/fcm-tokens"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * POST /api/pokemon-center/test-queue-alert — send test queue-live alerts.
 * Tap opens https://www.pokemoncenter.com/ by default (?url= override allowed).
 */
export async function POST(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const force =
    new URL(request.url).searchParams.get("force") === "1" ||
    new URL(request.url).searchParams.get("force") === "true"

  const urlParam = new URL(request.url).searchParams.get("url")?.trim()
  const targetUrl =
    urlParam && /^https:\/\/(www\.)?pokemoncenter\.com(\/|$)/i.test(urlParam)
      ? urlParam
      : POKEMON_CENTER_HOME_URL

  try {
    const registeredTokens = await listFcmDeviceTokens()
    const tokenStrings = registeredTokens.map((row) => row.deviceToken)

    const [webPush, fcmDevices, fcmTopic, registeredDeviceCount] = await Promise.all([
      sendTestQueueLiveWebPush({ force, targetUrl }),
      sendQueueLiveToDeviceTokens(tokenStrings, targetUrl, { test: true }),
      sendTestQueueLiveFcmTopicAlert(targetUrl),
      countFcmDeviceTokens(),
    ])

    const sent = webPush.sent || fcmDevices.sent > 0
    let reason = webPush.reason
    if (!sent) {
      if (registeredDeviceCount === 0) {
        reason = "no_registered_fcm_devices"
      } else if (fcmDevices.failed > 0 && fcmDevices.errors[0]) {
        reason = fcmDevices.errors[0]
      } else {
        reason = webPush.reason || fcmTopic.reason || "send_failed"
      }
    }

    return NextResponse.json({
      ok: true,
      test: true,
      force,
      targetUrl,
      sent,
      reason: sent ? undefined : reason,
      sentCount: (webPush.sentCount ?? 0) + fcmDevices.sent,
      registeredDeviceCount,
      webPush,
      fcmDevices,
      fcmTopic,
      fcmConfigured: isFcmAdminConfigured(),
      time: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Test queue alert failed",
      },
      { status: 500 },
    )
  }
}
