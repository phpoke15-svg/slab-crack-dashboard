import "server-only"
import { createAdminClient } from "@/lib/supabase/server"
import {
  getStoreReviewerPassword,
  STORE_REVIEWER_DISPLAY_NAME,
  STORE_REVIEWER_EMAIL,
} from "@/lib/store-reviewer"

export type StoreReviewerSetupResult = {
  email: string
  password: string
  userId: string
  created: boolean
  plan: string
}

export async function ensureStoreReviewerProAccount(): Promise<StoreReviewerSetupResult> {
  const admin = createAdminClient()
  const email = STORE_REVIEWER_EMAIL.toLowerCase()
  const password = getStoreReviewerPassword()

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) throw new Error(listError.message)

  let user = listed.users.find((row) => row.email?.toLowerCase() === email) ?? null
  let created = false

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { store_reviewer: true },
    })
    if (error || !data.user) {
      throw new Error(error?.message || "Could not create store reviewer account")
    }
    user = data.user
    created = true
  } else if (password) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { password })
    if (error) throw new Error(error.message)
  }

  const userId = user.id

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, handle")
    .eq("id", userId)
    .maybeSingle()

  if (existingProfile) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        plan: "pro",
        display_name: STORE_REVIEWER_DISPLAY_NAME,
        plan_updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
    if (profileError) throw new Error(profileError.message)
  } else {
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      handle: "appreview",
      display_name: STORE_REVIEWER_DISPLAY_NAME,
      plan: "pro",
      plan_updated_at: new Date().toISOString(),
    })
    if (profileError) throw new Error(profileError.message)
  }

  await admin
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .not("stripe_subscription_id", "like", "comp_reviewer_%")

  const compId = `comp_reviewer_${userId}`
  const row: Record<string, unknown> = {
    user_id: userId,
    stripe_subscription_id: compId,
    stripe_price_id: null,
    stripe_product_id: null,
    status: "active",
    plan: "pro",
    cancel_at_period_end: false,
    current_period_end: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { error: subError } = await admin.from("subscriptions").upsert(row, {
    onConflict: "stripe_subscription_id",
  })

  if (subError) throw new Error(subError.message)

  return {
    email: STORE_REVIEWER_EMAIL,
    password,
    userId,
    created,
    plan: "pro",
  }
}
