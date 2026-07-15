import { NextResponse } from "next/server"
import {
  countUnreadNotifications,
  listNotificationsForUser,
  markNotificationsRead,
} from "@/lib/notifications/service"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const limit = Math.min(
    Math.max(Number(new URL(request.url).searchParams.get("limit") ?? 40), 1),
    100,
  )

  const { notifications } = await listNotificationsForUser(auth.supabase, auth.user.id, limit)
  const unreadCount = await countUnreadNotifications(auth.supabase, auth.user.id)
  return NextResponse.json({ ok: true, notifications, unreadCount })
}

export async function PATCH(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as {
    ids?: string[]
    markAllRead?: boolean
  }

  if (body.markAllRead) {
    await markNotificationsRead(auth.supabase, auth.user.id)
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    await markNotificationsRead(auth.supabase, auth.user.id, body.ids)
  } else {
    return NextResponse.json({ error: "ids or markAllRead required" }, { status: 400 })
  }

  const { notifications } = await listNotificationsForUser(auth.supabase, auth.user.id, 40)
  const unreadCount = await countUnreadNotifications(auth.supabase, auth.user.id)
  return NextResponse.json({ ok: true, notifications, unreadCount })
}
