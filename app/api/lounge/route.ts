import { NextResponse } from "next/server"
import { requireLoungeAuth } from "@/lib/lounge/auth"
import { createLoungePost, getLoungeFeed } from "@/lib/lounge/store"
import type { LoungeFeedMode } from "@/lib/lounge/types"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** CardLounge feed — top-level posts or replies for a parent. */
export async function GET(request: Request) {
  const auth = await requireLoungeAuth()
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

/** Create a post or reply (JSON text-only, or multipart with photos/videos). */
export async function POST(request: Request) {
  const auth = await requireLoungeAuth()
  if (!auth.ok) return auth.response

  try {
    const contentType = request.headers.get("content-type") || ""
    let body = ""
    let parentId: string | null = null
    let files: File[] = []

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData()
      body = String(form.get("body") ?? "")
      const parentRaw = form.get("parentId")
      parentId = typeof parentRaw === "string" && parentRaw.trim() ? parentRaw.trim() : null
      files = form
        .getAll("files")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    } else {
      const json = (await request.json()) as { body?: string; parentId?: string | null }
      body = json.body ?? ""
      parentId = json.parentId ?? null
    }

    const post = await createLoungePost({
      authorId: auth.user.id,
      authorEmail: auth.user.email,
      body,
      parentId,
      files,
    })
    return NextResponse.json({ ok: true, post })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create post"
    const status =
      message.includes("1–") ||
      message.includes("Parent") ||
      message.includes("MB") ||
      message.includes("Only") ||
      message.includes("Up to") ||
      message.includes("Caption") ||
      message.includes("photo/video") ||
      message.includes("lounge-media.sql")
        ? 400
        : 500
    console.error("[lounge] create:", message)
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
