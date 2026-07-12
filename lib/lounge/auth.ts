import "server-only"
import { NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import type { User } from "@supabase/supabase-js"

export type SupremeAuth =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

/** Sign-in + Supreme entitlement gate for Lounge APIs. */
export async function requireSupreme(): Promise<SupremeAuth> {
  const auth = await requireUser()
  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 }),
    }
  }

  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.supreme) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Supreme access required" },
        { status: 403 },
      ),
    }
  }

  return { ok: true, user: auth.user }
}
