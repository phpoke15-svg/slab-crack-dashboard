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
      {/* Tabs */}
      <div className="sticky top-0 z-10 flex items-stretch border-b-2 border-border bg-card">
        <TabButton active={tab === "search"} onClick={() => setTab("search")}>
          Find Traders
        </TabButton>
        <TabButton active={tab === "friends"} onClick={() => setTab("friends")} className="border-l-2 border-border">
          Friends · {social.friendCount}
        </TabButton>
      </div>

      {tab === "search" && (
        <div className="p-3">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SEARCH BY NAME OR @HANDLE..."
              aria-label="Search for traders"
              className="h-11 w-full rounded-xs border-2 border-border bg-input pl-10 pr-3 font-mono text-sm uppercase tracking-wider text-foreground placeholder:text-muted-foreground placeholder:tracking-widest focus-visible:border-primary focus-visible:outline-none"
            />
          </div>
          {searchResults.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {searchResults.map((u) => (
                <TraderRow key={u.id} userId={u.id} />
              ))}
            </ul>
          ) : (
            <EmptyState label="No traders match your search" />
          )}
        </div>
      )}

      {tab === "friends" && (
        <div className="p-3">
          {friends.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {friends.map((u) => (
                <TraderRow key={u.id} userId={u.id} />
              ))}
            </ul>
          ) : (
            <EmptyState label="No friends yet — find traders to connect with" />
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
      <div className="flex items-center gap-3 rounded-xs border-2 border-border bg-secondary p-2">
        <button
          type="button"
          onClick={() => social.openProfile(userId)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <UserAvatar user={user} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-serif text-sm font-bold uppercase tracking-wide text-card-foreground">
              {user.name}
            </span>
            <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {user.handle}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5">
              <StarRating value={rating} size="sm" />
              <span className="font-mono text-[10px] text-muted-foreground">
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
            "group flex size-10 shrink-0 items-center justify-center rounded-xs border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isFriend
              ? "border-trade/70 bg-trade/15 text-trade hover:border-destructive/70 hover:bg-destructive/15 hover:text-destructive"
              : "border-primary/70 bg-primary text-primary-foreground",
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
  className,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={cn(
        "flex-1 px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        active ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-[10px] border-2 border-border bg-secondary px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-xs border-2 border-border bg-card text-muted-foreground">
        <Users className="size-5" aria-hidden="true" />
      </span>
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground text-pretty">{label}</p>
    </div>
  )
}
