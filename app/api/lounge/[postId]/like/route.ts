import { NextResponse } from "next/server"
import { requireLoungeAuth } from "@/lib/lounge/auth"
import { toggleLoungeLike } from "@/lib/lounge/store"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ postId: string }> }

/** Toggle like on a Lounge post. */
export async function POST(_request: Request, { params }: Params) {
  const auth = await requireLoungeAuth()
  if (!auth.ok) return auth.response

  try {
    const { postId } = await params
    const result = await toggleLoungeLike({ postId, viewerId: auth.user.id })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to like post"
    const status = message.includes("not found") ? 404 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
