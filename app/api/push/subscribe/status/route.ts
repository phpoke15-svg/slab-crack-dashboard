import { NextResponse } from "next/server"
import { requireQueueWatchAccess } from "@/lib/billing/stripe"
import { userHasQueuePushSubscription } from "@/lib/push/web-push"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

/** Signed-in users: whether queue_live is stored for this account. */
export async function GET() {
  const authResult = await requireUser()
  if (!authResult.ok) {
    return NextResponse.json({ signedIn: false, queueLiveOnServer: false })
  }

  const userId = authResult.user.id
  const hasPro = await requireQueueWatchAccess(userId)
  const queueLiveOnServer = hasPro ? await userHasQueuePushSubscription(userId) : false

  return NextResponse.json({
    signedIn: true,
    queueLiveOnServer,
    hasPro,
  })
}
