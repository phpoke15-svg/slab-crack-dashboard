import { NextResponse } from "next/server"
import { verifyApplePurchaseForUser, isAppleIapConfigured } from "@/lib/billing/apple"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

type RestoreItem = {
  transactionId?: string
  productId?: string
  originalTransactionId?: string
}

type Body = {
  purchases?: RestoreItem[]
}

/** Re-verify restored App Store purchases for the signed-in user. */
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

  const purchases = Array.isArray(body.purchases) ? body.purchases : []
  if (purchases.length === 0) {
    return NextResponse.json({ error: "No purchases to restore" }, { status: 400 })
  }

  const results: { productId: string; plan: string; status: string }[] = []
  let lastError: string | null = null

  for (const purchase of purchases) {
    const transactionId = purchase.transactionId?.trim()
    if (!transactionId) continue
    try {
      const verified = await verifyApplePurchaseForUser({
        userId: auth.user.id,
        transactionId,
        productId: purchase.productId?.trim() || null,
        originalTransactionId: purchase.originalTransactionId?.trim() || null,
      })
      results.push(verified)
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Restore failed"
    }
  }

  if (results.length === 0) {
    return NextResponse.json(
      { error: lastError || "Could not restore any purchases" },
      { status: 400 },
    )
  }

  const entitlements = await getEntitlementsForUser(auth.user.id)
  return NextResponse.json({
    ok: true,
    restored: results.length,
    results,
    entitlements,
    appleIapConfigured: isAppleIapConfigured(),
  })
}
