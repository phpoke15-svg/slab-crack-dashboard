import { NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { listRoadmapIdeas, setRoadmapVote } from "@/lib/feedback/store"

export const dynamic = "force-dynamic"

/** Signed-in users upvote (+1) or downvote (-1). Same vote again clears it. */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  let ideaId = ""
  let value: -1 | 1 | null = null
  try {
    const json = (await request.json()) as { ideaId?: string; value?: number }
    ideaId = String(json.ideaId ?? "").trim()
    const raw = Number(json.value)
    if (raw === 1 || raw === -1) value = raw
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  if (!ideaId || value == null) {
    return NextResponse.json(
      { ok: false, error: "ideaId and value (+1 or -1) are required" },
      { status: 400 },
    )
  }

  try {
    await setRoadmapVote({ userId: auth.user.id, ideaId, value })
    const ideas = await listRoadmapIdeas({ userId: auth.user.id })
    const idea = ideas.find((entry) => entry.id === ideaId) ?? null
    return NextResponse.json({ ok: true, idea, ideas })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save vote"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
