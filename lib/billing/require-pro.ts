import "server-only"
import { CARD_SCANNER_ENABLED } from "@/lib/feature-flags"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function requireCardScannerAccess() {
  if (!CARD_SCANNER_ENABLED) {
    return {
      ok: false as const,
      status: 503 as const,
      error: "Card scanner is temporarily unavailable.",
    }
  }
  const auth = await requireUser()
  if (!auth.ok) {
    return { ok: false as const, status: 401 as const, error: "Sign in to use the card scanner." }
  }
  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.cardScanner) {
    return {
      ok: false as const,
      status: 403 as const,
      error: "Card scanner is included with CollecTools Pro.",
    }
  }
  return { ok: true as const, auth, entitlements }
}
