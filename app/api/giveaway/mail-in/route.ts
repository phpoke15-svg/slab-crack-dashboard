import { NextResponse } from "next/server"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { addMailInEntries, resolveGiveawayUserId } from "@/lib/giveaway/service"
import { MAIL_IN_ENTRIES_PER_POSTCARD } from "@/lib/giveaway/constants"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

type Body = {
  user?: string
  quantity?: number
  notes?: string
}

/** Supreme-only: credit AMOE mail-in entries for a processed postcard. */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.supreme) {
    return NextResponse.json({ ok: false, error: "Supreme access required" }, { status: 403 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const target = await resolveGiveawayUserId(String(body.user ?? ""))
  if (!target) {
    return NextResponse.json(
      { ok: false, error: "User not found — pass profile handle or user id" },
      { status: 404 },
    )
  }

  const quantity = body.quantity ?? MAIL_IN_ENTRIES_PER_POSTCARD
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 7) {
    return NextResponse.json({ ok: false, error: "quantity must be 1–7" }, { status: 400 })
  }

  try {
    const result = await addMailInEntries(target, {
      quantity: Math.round(quantity),
      adminId: auth.user.id,
      notes: body.notes,
    })
    return NextResponse.json({ ok: true, userId: target, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add mail-in entries"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
