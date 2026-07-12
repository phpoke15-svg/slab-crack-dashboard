import type { SupabaseClient } from "@supabase/supabase-js"
import { resolvePlansForUserIds } from "@/lib/billing/resolve-plans"
import type { PlanId } from "@/lib/billing/plans"
import {
  formatHandleInput,
  profileRowToTrader,
  type BinderVisibility,
  type ProfileRow,
  type TraderProfile,
} from "@/lib/trade-binder/profile"

async function withPlan(profile: TraderProfile): Promise<TraderProfile> {
  const plans = await resolvePlansForUserIds([profile.id])
  return { ...profile, plan: plans.get(profile.id) ?? "free" }
}

async function withPlans(profiles: TraderProfile[]): Promise<TraderProfile[]> {
  if (profiles.length === 0) return []
  const plans = await resolvePlansForUserIds(profiles.map((p) => p.id))
  return profiles.map((p) => ({ ...p, plan: plans.get(p.id) ?? ("free" as PlanId) }))
}

export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<TraderProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()
  if (error || !data) return null
  return withPlan(profileRowToTrader(data as ProfileRow))
}

export async function ensureProfile(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
): Promise<TraderProfile> {
  const existing = await fetchProfile(supabase, userId)
  if (existing) return existing

  const base = formatHandleInput(email?.split("@")[0] ?? "collector") || "collector"
  let handle = base
  let suffix = 0
  while (true) {
    const { data } = await supabase.from("profiles").select("id").eq("handle", handle).maybeSingle()
    if (!data) break
    suffix += 1
    handle = `${base}${suffix}`
  }

  const displayName = email?.split("@")[0] ?? "Collector"
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      handle,
      display_name: displayName,
    })
    .select("*")
    .single()

  if (error || !data) {
    return withPlan({
      id: userId,
      name: displayName,
      handle: `@${handle}`,
      avatar: "",
      location: "",
      bio: "",
      binderVisibility: "public",
      plan: "free",
    })
  }
  return withPlan(profileRowToTrader(data as ProfileRow))
}

export async function searchProfiles(
  supabase: SupabaseClient,
  query: string,
  excludeUserId?: string,
  limit = 20,
): Promise<TraderProfile[]> {
  const q = query.trim().toLowerCase()
  if (q.length < 1) return []

  let builder = supabase
    .from("profiles")
    .select("*")
    .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(limit)

  if (excludeUserId) builder = builder.neq("id", excludeUserId)

  const { data, error } = await builder
  if (error || !data) return []
  return withPlans((data as ProfileRow[]).map((row) => profileRowToTrader(row)))
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: {
    displayName?: string
    handle?: string
    bio?: string
    location?: string
    avatarUrl?: string
    binderVisibility?: BinderVisibility
  },
): Promise<{ profile: TraderProfile | null; error: string | null }> {
  const row: Partial<ProfileRow> = { updated_at: new Date().toISOString() }
  if (patch.displayName !== undefined) row.display_name = patch.displayName.trim()
  if (patch.handle !== undefined) row.handle = formatHandleInput(patch.handle)
  if (patch.bio !== undefined) row.bio = patch.bio.trim()
  if (patch.location !== undefined) row.location = patch.location.trim()
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl.trim()
  if (patch.binderVisibility !== undefined) row.binder_visibility = patch.binderVisibility

  const { data, error } = await supabase
    .from("profiles")
    .update(row)
    .eq("id", userId)
    .select("*")
    .single()

  if (error) return { profile: null, error: error.message }
  return { profile: await withPlan(profileRowToTrader(data as ProfileRow)), error: null }
}
