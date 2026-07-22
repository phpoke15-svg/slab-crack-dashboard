import { NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { getEntitlementsForUser, isStripeConfigured } from "@/lib/billing/stripe"
import { isAppleIapConfigured } from "@/lib/billing/apple-iap"
import { entitlementsForPlan } from "@/lib/billing/plans"
import { touchLastSeen } from "@/lib/presence"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({
      ...entitlementsForPlan("free"),
      signedIn: false,
      stripeConfigured: isStripeConfigured(),
      appleIapConfigured: isAppleIapConfigured(),
    })
  }

  try {
    void touchLastSeen(auth.user.id)
    const entitlements = await getEntitlementsForUser(auth.user.id)
    return NextResponse.json({
      ...entitlements,
      signedIn: true,
      stripeConfigured: isStripeConfigured(),
      appleIapConfigured: isAppleIapConfigured(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load entitlements"
    return NextResponse.json(
      {
        ...entitlementsForPlan("free"),
        signedIn: true,
        stripeConfigured: isStripeConfigured(),
        appleIapConfigured: isAppleIapConfigured(),
        error: message,
      },
      { status: 500 },
    )
  }
}
