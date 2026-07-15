import { NextResponse } from "next/server"
import { requireUser, createRouteClient } from "@/lib/trade-binder/supabase/route-auth"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { createRoadmapIdea, listRoadmapIdeas } from "@/lib/feedback/store"

export const dynamic = "force-dynamic"

/** Public list of potential tools with vote totals. Includes myVote when signed in. */
export async function GET() {
  try {
    const supabase = await createRouteClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const ideas = await listRoadmapIdeas({ userId: user?.id ?? null })
    return NextResponse.json({ ok: true, ideas })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load roadmap"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** Supreme-only: add a potential tool idea for voting. */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.supreme) {
    return NextResponse.json({ ok: false, error: "Supreme access required" }, { status: 403 })
  }

  let title = ""
  let description = ""
  try {
    const json = (await request.json()) as { title?: string; description?: string }
    title = String(json.title ?? "")
    description = String(json.description ?? "")
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    const result = await createRoadmapIdea({
      createdBy: auth.user.id,
      title,
      description,
    })
    return NextResponse.json({ ok: true, id: result.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create idea"
    const status = /between 1 and 120|1000 characters|not set up yet/i.test(message) ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
