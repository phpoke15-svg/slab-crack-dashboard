import { NextResponse } from "next/server"
import { requireSupreme } from "@/lib/lounge/auth"
import { createLoungePost, getLoungeFeed } from "@/lib/lounge/store"
import type { LoungeFeedMode } from "@/lib/lounge/types"

export const dynamic = "force-dynamic"

/** Supreme Lounge feed — top-level posts or replies for a parent. */
export async function GET(request: Request) {
  const auth = await requireSupreme()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const mode = (searchParams.get("mode") === "following" ? "following" : "all") as LoungeFeedMode
    const parentId = searchParams.get("parentId")
    const feed = await getLoungeFeed({
      viewerId: auth.user.id,
      viewerEmail: auth.user.email,
      mode,
      parentId: parentId || null,
    })
    return NextResponse.json(feed)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load lounge"
    console.error("[lounge]", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** Create a post or reply. */
export async function POST(request: Request) {
  const auth = await requireSupreme()
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as { body?: string; parentId?: string | null }
    const post = await createLoungePost({
      authorId: auth.user.id,
      authorEmail: auth.user.email,
      body: body.body ?? "",
      parentId: body.parentId ?? null,
    })
    return NextResponse.json({ ok: true, post })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create post"
    const status = message.includes("1–") || message.includes("Parent") ? 400 : 500
    console.error("[lounge] create:", message)
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
