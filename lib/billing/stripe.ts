import "server-only"
import Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/server"
import {
  entitlementsForPlan,
  planFromStripePriceId,
  planRank,
  type Entitlements,
  type PlanId,
} from "@/lib/billing/plans"

let stripeClient: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured")
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
    })
  }
  return stripeClient
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}

const ACTIVE_STATUSES = new Set(["active", "trialing"])

export function planFromSubscriptionStatus(
  status: string | null | undefined,
  priceId: string | null | undefined,
): PlanId {
  if (!status || !ACTIVE_STATUSES.has(status)) return "free"
  return planFromStripePriceId(priceId)
}

export async function getEntitlementsForUser(userId: string): Promise<Entitlements> {
  const admin = createAdminClient()

  const [{ data: profile }, { data: subs }] = await Promise.all([
    admin.from("profiles").select("plan").eq("id", userId).maybeSingle(),
    admin
      .from("subscriptions")
      .select("status, plan, stripe_price_id, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(5),
  ])

  const activeSub = (subs ?? []).find((row) => ACTIVE_STATUSES.has(String(row.status)))
  if (activeSub) {
    const plan = (activeSub.plan as PlanId) || planFromStripePriceId(activeSub.stripe_price_id)
    return entitlementsForPlan(plan, {
      status: String(activeSub.status),
      currentPeriodEnd: activeSub.current_period_end
        ? new Date(activeSub.current_period_end).toISOString()
        : null,
      cancelAtPeriodEnd: Boolean(activeSub.cancel_at_period_end),
    })
  }

  const profilePlan = (profile?.plan as PlanId | undefined) ?? "free"
  return entitlementsForPlan(profilePlan === "free" ? "free" : profilePlan, {
    status: null,
  })
}

export async function requireQueueWatchAccess(userId: string): Promise<boolean> {
  const entitlements = await getEntitlementsForUser(userId)
  return entitlements.queueWatch
}

type UpsertSubscriptionInput = {
  userId: string
  stripeSubscriptionId: string
  stripePriceId: string | null
  stripeProductId: string | null
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: Date | null
}

export async function upsertSubscriptionFromStripe(
  input: UpsertSubscriptionInput,
): Promise<PlanId> {
  const admin = createAdminClient()
  const plan = planFromSubscriptionStatus(input.status, input.stripePriceId)

  const { error: subError } = await admin.from("subscriptions").upsert(
    {
      user_id: input.userId,
      stripe_subscription_id: input.stripeSubscriptionId,
      stripe_price_id: input.stripePriceId,
      stripe_product_id: input.stripeProductId,
      status: input.status,
      plan,
      cancel_at_period_end: input.cancelAtPeriodEnd,
      current_period_end: input.currentPeriodEnd?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  )

  if (subError) throw new Error(subError.message)

  // Resolve effective plan from all active subs (prefer highest tier).
  const { data: activeSubs } = await admin
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", input.userId)

  let best: PlanId = "free"
  for (const row of activeSubs ?? []) {
    if (!ACTIVE_STATUSES.has(String(row.status))) continue
    const candidate = (row.plan as PlanId) || "free"
    if (planRank(candidate) > planRank(best)) best = candidate
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      plan: best,
      plan_updated_at: new Date().toISOString(),
    })
    .eq("id", input.userId)

  if (profileError) throw new Error(profileError.message)

  return best
}

export async function ensureStripeCustomer(userId: string, email: string | null): Promise<string> {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, display_name, handle")
    .eq("id", userId)
    .maybeSingle()

  if (profile?.stripe_customer_id) return profile.stripe_customer_id

  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: profile?.display_name || profile?.handle || undefined,
    metadata: { supabase_user_id: userId },
  })

  const { error } = await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId)

  if (error) throw new Error(error.message)
  return customer.id
}

export function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const end = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end
  if (!end) return null
  return new Date(end * 1000)
}

export async function syncStripeSubscription(
  subscription: Stripe.Subscription,
  fallbackUserId?: string,
): Promise<PlanId> {
  const userId =
    subscription.metadata?.supabase_user_id ||
    fallbackUserId ||
    (typeof subscription.customer === "string"
      ? await userIdFromStripeCustomer(subscription.customer)
      : null)

  if (!userId) throw new Error("Cannot resolve user for Stripe subscription")

  const price = subscription.items.data[0]?.price
  return upsertSubscriptionFromStripe({
    userId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: price?.id ?? null,
    stripeProductId:
      typeof price?.product === "string" ? price.product : price?.product?.id ?? null,
    status: subscription.status,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodEnd: subscriptionPeriodEnd(subscription),
  })
}

async function userIdFromStripeCustomer(customerId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()
  return data?.id ?? null
}
