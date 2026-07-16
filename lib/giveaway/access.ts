import { getEntitlementsForUser } from "@/lib/billing/stripe"

/** Giveaway stays in Supreme-only preview until rules, prize, and AMOE are finalized. */
export async function requireGiveawayAccess(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const entitlements = await getEntitlementsForUser(userId)
  if (!entitlements.supreme) {
    return { ok: false, error: "Giveaway is not available yet", status: 403 }
  }
  return { ok: true }
}
