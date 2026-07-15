import { NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { listFeedbackMessages, submitFeedback } from "@/lib/feedback/store"

export const dynamic = "force-dynamic"

/** Supreme-only inbox. */
export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.supreme) {
    return NextResponse.json({ ok: false, error: "Supreme access required" }, { status: 403 })
  }

  try {
    const messages = await listFeedbackMessages()
    return NextResponse.json({ ok: true, messages })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load feedback"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** Any signed-in user can submit feedback. */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  let body = ""
  try {
    const json = (await request.json()) as { body?: string }
    body = String(json.body ?? "")
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    const result = await submitFeedback({ authorId: auth.user.id, body })
    return NextResponse.json({ ok: true, id: result.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit feedback"
    const status = /between 1 and 4000|not set up yet/i.test(message) ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
