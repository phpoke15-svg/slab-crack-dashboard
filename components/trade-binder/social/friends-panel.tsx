"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, UserPlus, UserCheck, UserX, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { CURRENT_USER_ID } from "@/lib/trade-binder/users"
import { useSocial } from "./social-provider"
import { PanelShell } from "./panel-shell"
import { UserAvatar } from "./user-avatar"
import { StarRating } from "./star-rating"

type Tab = "search" | "friends"

export function FriendsPanel() {
  const social = useSocial()
  const [tab, setTab] = useState<Tab>("search")
  const [query, setQuery] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    const others = social.users.filter((u) => u.id !== CURRENT_USER_ID)
    if (q === "") return others
    return others.filter(
      (u) => u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q),
    )
  }, [social.users, query])

  const friends = useMemo(
    () => social.friendIds.map((id) => social.getUser(id)).filter((u) => u !== undefined),
    [social],
  )

  return (
    <PanelShell title="Traders" onClose={social.close}>
      <div className="sticky top-0 z-10 flex gap-1 border-b border-border bg-background px-4 py-2">
        <TabButton active={tab === "search"} onClick={() => setTab("search")}>
          Find traders
        </TabButton>
        <TabButton active={tab === "friends"} onClick={() => setTab("friends")}>
          Friends · {social.friendCount}
        </TabButton>
      </div>

      {tab === "search" && (
        <div className="p-4">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or handle…"
              aria-label="Search for traders"
              className="h-11 w-full rounded-xl border border-border bg-secondary/60 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50 focus:bg-secondary"
            />
          </div>
          {searchResults.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {searchResults.map((u) => (
                <TraderRow key={u.id} userId={u.id} />
              ))}
            </ul>
          ) : (
            <EmptyState label="No traders match your search." />
          )}
        </div>
      )}

      {tab === "friends" && (
        <div className="p-4">
          {friends.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {friends.map((u) => (
                <TraderRow key={u.id} userId={u.id} />
              ))}
            </ul>
          ) : (
            <EmptyState label="No friends yet — find traders to connect with." />
          )}
        </div>
      )}
    </PanelShell>
  )
}

function TraderRow({ userId }: { userId: string }) {
  const social = useSocial()
  const user = social.getUser(userId)
  if (!user) return null
  const isFriend = social.isFriend(userId)
  const rating = social.ratingFor(userId)
  const reviewCount = social.reviewsFor(userId).length

  return (
    <li>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-2.5">
        <button
          type="button"
          onClick={() => social.openProfile(userId)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UserAvatar user={user} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{user.handle}</span>
            <span className="mt-0.5 flex items-center gap-1.5">
              <StarRating value={rating} size="sm" />
              <span className="text-[10px] text-muted-foreground">
                {rating > 0 ? `${rating.toFixed(1)} (${reviewCount})` : "No reviews"}
              </span>
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => (isFriend ? social.removeFriend(userId) : social.addFriend(userId))}
          aria-label={isFriend ? `Remove ${user.name} from friends` : `Add ${user.name} as a friend`}
          className={cn(
            "group flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isFriend
              ? "border-trade/50 bg-trade/15 text-trade hover:border-destructive/50 hover:bg-destructive/15 hover:text-destructive"
              : "border-primary/50 bg-primary text-primary-foreground",
          )}
        >
          {isFriend ? (
            <>
              <UserCheck className="size-4 group-hover:hidden" aria-hidden="true" />
              <UserX className="hidden size-4 group-hover:block" aria-hidden="true" />
            </>
          ) : (
            <UserPlus className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </li>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={cn(
        "relative flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {active && <span className="absolute inset-x-2 -bottom-2 h-0.5 rounded-full bg-primary" />}
    </button>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card/60 px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
        <Users className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted-foreground text-pretty">{label}</p>
    </div>
  )
}
