import type { BinderVisibility, TraderProfile } from "@/lib/trade-binder/profile"

export type BinderAccessReason =
  | "self"
  | "visible"
  | "empty"
  | "private"
  | "friends_only"
  | "not_friends"

export function resolveBinderAccess(input: {
  profile: TraderProfile
  isSelf: boolean
  isFriend: boolean
  cardCount: number
}): BinderAccessReason {
  const { profile, isSelf, isFriend, cardCount } = input
  if (isSelf) return "self"

  const vis = profile.binderVisibility ?? "public"
  if (vis === "private") return "private"
  if (vis === "friends" && !isFriend) return "friends_only"
  if (cardCount === 0) return "empty"
  return "visible"
}

export function binderAccessMessage(reason: BinderAccessReason): string | null {
  switch (reason) {
    case "private":
      return "This trader's binder is set to private."
    case "friends_only":
      return "This trader only shares their binder with friends. Add them as a friend to view it."
    case "empty":
      return "This trader has not listed any cards yet."
    default:
      return null
  }
}

export function canViewBinderByPolicy(input: {
  binderVisibility: BinderVisibility
  isSelf: boolean
  isFriend: boolean
}): boolean {
  if (input.isSelf) return true
  if (input.binderVisibility === "public") return true
  if (input.binderVisibility === "private") return false
  return input.isFriend
}
