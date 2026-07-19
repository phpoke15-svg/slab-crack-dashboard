import "server-only"

import type Stripe from "stripe"
import { getStripe } from "@/lib/billing/stripe"
import {
  normalizePromotionCode,
  promotionCodeLooksValid,
} from "@/lib/billing/promotion-code-parse"

export { normalizePromotionCode, promotionCodeLooksValid } from "@/lib/billing/promotion-code-parse"

export type ResolvedPromotionCode = {
  id: string
  code: string
  percentOff: number | null
  amountOff: number | null
  currency: string | null
  duration: Stripe.Coupon.Duration
}

function couponSummary(coupon: Stripe.Coupon): Pick<
  ResolvedPromotionCode,
  "percentOff" | "amountOff" | "currency" | "duration"
> {
  return {
    percentOff: coupon.percent_off ?? null,
    amountOff: coupon.amount_off ? coupon.amount_off / 100 : null,
    currency: coupon.currency ?? null,
    duration: coupon.duration,
  }
}

function promotionCodeErrorMessage(error: unknown, code: string): string {
  const raw = error instanceof Error ? error.message : ""
  if (/no such promotion code/i.test(raw)) {
    return `Promotion code "${code}" was not found. Check spelling or ask support for a new code.`
  }
  if (/expired|inactive/i.test(raw)) {
    return `Promotion code "${code}" is expired or inactive.`
  }
  if (/maximum redemption/i.test(raw)) {
    return `Promotion code "${code}" has already been used the maximum number of times.`
  }
  return `Promotion code "${code}" could not be applied.`
}

/** Resolve a customer-facing promotion code string to an active Stripe promotion code. */
export async function resolvePromotionCode(
  input: string,
): Promise<{ ok: true; promotion: ResolvedPromotionCode } | { ok: false; error: string }> {
  const code = normalizePromotionCode(input)
  if (!promotionCodeLooksValid(code)) {
    return { ok: false, error: "Enter a valid promotion code." }
  }

  try {
    const stripe = getStripe()
    const listed = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
      expand: ["data.coupon"],
    })

    const promotion = listed.data[0]
    if (!promotion) {
      return {
        ok: false,
        error: `Promotion code "${code}" was not found or is no longer active.`,
      }
    }

    const coupon =
      typeof promotion.coupon === "string"
        ? await stripe.coupons.retrieve(promotion.coupon)
        : promotion.coupon

    if (!coupon || coupon.valid === false) {
      return {
        ok: false,
        error: `Promotion code "${code}" is linked to an inactive coupon.`,
      }
    }

    return {
      ok: true,
      promotion: {
        id: promotion.id,
        code: promotion.code,
        ...couponSummary(coupon),
      },
    }
  } catch (error) {
    return { ok: false, error: promotionCodeErrorMessage(error, code) }
  }
}

export function promotionDiscountLabel(promotion: ResolvedPromotionCode): string {
  if (promotion.percentOff) return `${promotion.percentOff}% off`
  if (promotion.amountOff && promotion.currency) {
    return `${promotion.amountOff.toFixed(2)} ${promotion.currency.toUpperCase()} off`
  }
  return "Discount applied"
}
