import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import {
  ensureStripeCustomer,
  getStripe,
  isStripeConfigured,
} from "@/lib/billing/stripe"
import {
  getStripePriceId,
  parsePriceKey,
  planFromPriceKey,
} from "@/lib/billing/plans"
import { LEGAL_SITE_URL } from "@/lib/legal/config"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Set STRIPE_SECRET_KEY and price IDs." },
      { status: 503 },
    )
  }

  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const priceKey = parsePriceKey(String(body.priceKey ?? ""))
  if (!priceKey) {
    return NextResponse.json(
      { error: "Invalid priceKey. Use premium_month, premium_year, pro_month, or pro_year." },
      { status: 400 },
    )
  }

  const priceId = getStripePriceId(priceKey)
  if (!priceId) {
    return NextResponse.json(
      { error: `Missing Stripe price env for ${priceKey}` },
      { status: 503 },
    )
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || LEGAL_SITE_URL).replace(/\/$/, "")
  const plan = planFromPriceKey(priceKey)

  try {
    const customerId = await ensureStripeCustomer(auth.user.id, auth.user.email ?? null)
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: auth.user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/pricing?checkout=success&plan=${plan}`,
      cancel_url: `${siteUrl}/pricing?checkout=cancel`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          supabase_user_id: auth.user.id,
          plan,
          price_key: priceKey,
        },
      },
      metadata: {
        supabase_user_id: auth.user.id,
        plan,
        price_key: priceKey,
      },
    })

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
