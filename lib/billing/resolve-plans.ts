import "server-only"
import { createAdminClient } from "@/lib/supabase/server"
import {
  isSupremeEmail,
  planFromStripePriceId,
  planRank,
  type PlanId,
} from "@/lib/billing/plans"

const ACTIVE_STATUSES = new Set(["active", "trialing"])

/**
 * Resolve best account tier for many users (CardLounge badges).
 * Uses profiles.plan + active subscriptions; Supreme email allowlist overrides.
 */
export async function resolvePlansForUserIds(
  userIds: string[],
): Promise<Map<string, PlanId>> {
  const unique = [...new Set(userIds.filter(Boolean))]
  const map = new Map<string, PlanId>()
  for (const id of unique) map.set(id, "free")
  if (unique.length === 0) return map

  const admin = createAdminClient()

  const [{ data: profiles }, { data: subs }] = await Promise.all([
    admin.from("profiles").select("id, plan").in("id", unique),
    admin
      .from("subscriptions")
      .select("user_id, status, plan, stripe_price_id")
      .in("user_id", unique)
      .in("status", ["active", "trialing"]),
  ])

  for (const row of profiles ?? []) {
    const plan = (row.plan as PlanId | undefined) ?? "free"
    map.set(row.id as string, plan === "free" ? "free" : plan)
  }

  for (const row of subs ?? []) {
    if (!ACTIVE_STATUSES.has(String(row.status))) continue
    const userId = row.user_id as string
    const fromColumn = (row.plan as PlanId) || "free"
    const fromPrice = planFromStripePriceId(row.stripe_price_id as string | null)
    const candidate = planRank(fromColumn) >= planRank(fromPrice) ? fromColumn : fromPrice
    const current = map.get(userId) ?? "free"
    if (planRank(candidate) > planRank(current)) map.set(userId, candidate)
  }

  for (const row of profiles ?? []) {
    if ((row.plan as PlanId) === "supreme") map.set(row.id as string, "supreme")
  }

  // Supreme email allowlist (small set) — only check authors not already Supreme.
  const needsEmailCheck = unique.filter((id) => map.get(id) !== "supreme")
  await Promise.all(
    needsEmailCheck.map(async (userId) => {
      try {
        const { data } = await admin.auth.admin.getUserById(userId)
        if (isSupremeEmail(data.user?.email)) map.set(userId, "supreme")
      } catch {
        // ignore
      }
    }),
  )

  return map
}
