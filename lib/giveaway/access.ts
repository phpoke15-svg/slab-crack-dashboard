import { getEntitlementsForUser } from "@/lib/billing/stripe"

/** Any signed-in user can participate in the monthly giveaway. */
export async function requireGiveawayAccess(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!userId?.trim()) {
    return { ok: false, error: "Sign in required", status: 401 }
  }
  return { ok: true }
}

/** Supreme-only giveaway admin actions (mail-in credit, ops prize API). */
export async function requireGiveawayAdminAccess(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const entitlements = await getEntitlementsForUser(userId)
  if (!entitlements.supreme) {
    return { ok: false, error: "Admin access required", status: 403 }
  }
  return { ok: true }
}
