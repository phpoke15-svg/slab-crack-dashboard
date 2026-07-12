import "server-only"
import { NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import type { User } from "@supabase/supabase-js"

export type LoungeAuth =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

/** Sign-in required for CardLounge APIs (all account tiers). */
export async function requireLoungeAuth(): Promise<LoungeAuth> {
  const auth = await requireUser()
  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 }),
    }
  }

  return { ok: true, user: auth.user }
}

/** @deprecated Use requireLoungeAuth — CardLounge is open to all signed-in users. */
export async function requireSupreme(): Promise<LoungeAuth> {
  return requireLoungeAuth()
}
