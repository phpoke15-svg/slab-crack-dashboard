import { NextResponse } from "next/server"
import { requireLoungeAuth } from "@/lib/lounge/auth"
import { deleteLoungePost } from "@/lib/lounge/store"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ postId: string }> }

/** Delete your own Lounge post. */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireLoungeAuth()
  if (!auth.ok) return auth.response

  try {
    const { postId } = await params
    await deleteLoungePost({ postId, viewerId: auth.user.id })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete post"
    const status = message.includes("own posts") ? 403 : message.includes("not found") ? 404 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
