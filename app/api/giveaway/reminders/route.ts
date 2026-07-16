import { NextResponse } from "next/server"
import { requireGiveawayAccess } from "@/lib/giveaway/access"
import {
  getGiveawayReminderEnabled,
  setGiveawayReminderEnabled,
  userHasPushSubscription,
} from "@/lib/giveaway/reminder-push"
import { isWebPushConfigured } from "@/lib/push/web-push"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const access = await requireGiveawayAccess(auth.user.id)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  try {
    const [enabled, hasPushSubscription] = await Promise.all([
      getGiveawayReminderEnabled(auth.user.id),
      userHasPushSubscription(auth.user.id),
    ])

    return NextResponse.json({
      ok: true,
      enabled,
      hasPushSubscription,
      pushConfigured: isWebPushConfigured(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load reminder settings"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const access = await requireGiveawayAccess(auth.user.id)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  let body: { enabled?: boolean }
  try {
    body = (await request.json()) as { enabled?: boolean }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ ok: false, error: "enabled must be a boolean" }, { status: 400 })
  }

  if (body.enabled) {
    const hasPush = await userHasPushSubscription(auth.user.id)
    if (!hasPush) {
      return NextResponse.json(
        {
          ok: false,
          error: "Enable browser notifications first, then turn on giveaway reminders.",
          needsPushSubscription: true,
        },
        { status: 400 },
      )
    }
  }

  try {
    await setGiveawayReminderEnabled(auth.user.id, body.enabled)
    return NextResponse.json({ ok: true, enabled: body.enabled })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update reminder settings"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
