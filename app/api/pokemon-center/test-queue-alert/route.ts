import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { sendTestQueueLiveWebPush } from "@/lib/pokemon-center/queue-alerts"
import { isFcmAdminConfigured, sendTestQueueLiveFcmAlert } from "@/lib/push/fcm-admin"
import { getSiteUrl } from "@/lib/site-url"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * POST /api/pokemon-center/test-queue-alert — send test queue-live alerts.
 * - Web Push: Pro/Supreme browser subscribers on /pokewatch
 * - FCM: native iOS/Android app subscribers on the queue topic
 * Requires CRON_SECRET Bearer auth. Pass ?force=1 to bypass web-push dedupe.
 */
export async function POST(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const force =
    new URL(request.url).searchParams.get("force") === "1" ||
    new URL(request.url).searchParams.get("force") === "true"

  try {
    const site = getSiteUrl()
    const [webPush, fcm] = await Promise.all([
      sendTestQueueLiveWebPush({ force }),
      sendTestQueueLiveFcmAlert(`${site}/pokewatch`),
    ])

    const sent = webPush.sent || fcm.sent
    let reason = webPush.reason
    if (!sent) {
      if (!webPush.sent && !fcm.sent) {
        reason =
          webPush.reason === "no_queue_subscribers" && fcm.reason === "fcm_not_configured"
            ? "no_web_push_subscribers_and_fcm_not_configured"
            : webPush.reason || fcm.reason
      } else if (!webPush.sent) {
        reason = webPush.reason
      } else {
        reason = fcm.reason
      }
    }

    return NextResponse.json({
      ok: true,
      test: true,
      force,
      sent,
      reason: sent ? undefined : reason,
      sentCount: webPush.sentCount ?? 0,
      webPush,
      fcm,
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
