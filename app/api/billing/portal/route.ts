import { NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import {
  ensureStripeCustomer,
  getStripe,
  isStripeConfigured,
} from "@/lib/billing/stripe"
import { LEGAL_SITE_URL } from "@/lib/legal/config"

export const dynamic = "force-dynamic"

export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 })
  }

  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || LEGAL_SITE_URL).replace(/\/$/, "")

  try {
    const customerId = await ensureStripeCustomer(auth.user.id, auth.user.email ?? null)
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/pricing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portal failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
