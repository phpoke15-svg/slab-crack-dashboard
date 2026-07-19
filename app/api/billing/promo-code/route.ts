import { NextResponse } from "next/server"
import {
  promotionDiscountLabel,
  promotionCodeLooksValid,
  resolvePromotionCode,
} from "@/lib/billing/promotion-code"
import { isStripeConfigured } from "@/lib/billing/stripe"

export const dynamic = "force-dynamic"

/** Validate a Stripe promotion code before checkout. */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ ok: false, error: "Billing is not configured yet." }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const code = String(body.code ?? "")
  if (!promotionCodeLooksValid(code)) {
    return NextResponse.json({ ok: false, error: "Enter a valid promotion code." }, { status: 400 })
  }

  const resolved = await resolvePromotionCode(code)
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    code: resolved.promotion.code,
    label: promotionDiscountLabel(resolved.promotion),
    percentOff: resolved.promotion.percentOff,
    amountOff: resolved.promotion.amountOff,
    currency: resolved.promotion.currency,
  })
}
