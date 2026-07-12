import { NextResponse } from "next/server"
import { requireLoungeAuth } from "@/lib/lounge/auth"
import { setLoungeFollow } from "@/lib/lounge/store"

export const dynamic = "force-dynamic"

/** Follow / unfollow another collector in the Lounge. */
export async function POST(request: Request) {
  const auth = await requireLoungeAuth()
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as { userId?: string; follow?: boolean }
    if (!body.userId?.trim()) {
      return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 })
    }
    const result = await setLoungeFollow({
      viewerId: auth.user.id,
      targetUserId: body.userId.trim(),
      follow: body.follow !== false,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update follow"
    const status =
      message.includes("yourself") || message.includes("not found") ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
