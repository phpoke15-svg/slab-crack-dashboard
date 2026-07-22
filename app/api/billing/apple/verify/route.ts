import { NextResponse } from "next/server"
import { verifyApplePurchaseForUser, isAppleIapConfigured } from "@/lib/billing/apple"
import { appleProductIdFromPriceKey } from "@/lib/billing/apple-iap"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { parsePriceKey } from "@/lib/billing/plans"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

type Body = {
  transactionId?: string
  productId?: string
  originalTransactionId?: string
  priceKey?: string
}

/** Validate an App Store transaction and sync entitlements for the signed-in user. */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const transactionId = body.transactionId?.trim()
  if (!transactionId) {
    return NextResponse.json({ error: "transactionId required" }, { status: 400 })
  }

  let productId = body.productId?.trim() || null
  if (!productId && body.priceKey) {
    const priceKey = parsePriceKey(body.priceKey)
    if (priceKey) {
      productId = appleProductIdFromPriceKey(priceKey)
    }
  }

  try {
    const verified = await verifyApplePurchaseForUser({
      userId: auth.user.id,
      transactionId,
      productId,
      originalTransactionId: body.originalTransactionId?.trim() || null,
    })
    const entitlements = await getEntitlementsForUser(auth.user.id)

    return NextResponse.json({
      ok: true,
      verified,
      entitlements,
      appleIapConfigured: isAppleIapConfigured(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apple purchase verification failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
