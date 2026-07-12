import type { PlanId } from "@/lib/billing/plans"

export type BinderVisibility = "private" | "friends" | "public"

export type ProfileRow = {
  id: string
  handle: string
  display_name: string
  bio: string
  location: string
  avatar_url: string
  binder_visibility: BinderVisibility
  created_at: string
  updated_at: string
}

export type TraderProfile = {
  id: string
  name: string
  handle: string
  avatar: string
  location: string
  bio: string
  binderVisibility: BinderVisibility
  /** Account tier — free displays as Starter. */
  plan: PlanId
}

export function profileRowToTrader(row: ProfileRow, plan: PlanId = "free"): TraderProfile {
  return {
    id: row.id,
    name: row.display_name || row.handle,
    handle: `@${row.handle}`,
    avatar: row.avatar_url || "",
    location: row.location,
    bio: row.bio,
    binderVisibility: row.binder_visibility,
    plan,
  }
}

export function formatHandleInput(handle: string): string {
  return handle.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_]/g, "")
}
