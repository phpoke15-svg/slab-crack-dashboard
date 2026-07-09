"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  Search,
  UserPlus,
  UserCheck,
  UserX,
  Users,
  Loader2,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { FriendshipStatus, User } from "@/lib/trade-binder/users"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useSocial } from "./social-provider"
import { PanelShell } from "./panel-shell"
import { UserAvatar } from "./user-avatar"
import { StarRating } from "./star-rating"

type Tab = "search" | "requests" | "friends"

export function FriendsPanel() {
  const social = useSocial()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>(
    social.pendingFriendRequestCount > 0 ? "requests" : "search",
  )
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (tab === "search") searchRef.current?.focus()
  }, [tab])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 1) {
      setSearchResults([])
      return
    }

    setSearching(true)
    const timer = window.setTimeout(() => {
      fetch(`/api/profile/search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : { profiles: [] }))
        .then((data: { profiles?: User[] }) => {
          const profiles = data.profiles ?? []
          for (const p of profiles) social.cacheProfile(p)
          setSearchResults(profiles)
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false))
    }, 300)

    return () => window.clearTimeout(timer)
  }, [query, social.cacheProfile])

  const friends = useMemo(
    () =>
      social.friendIds
        .map((id) => social.getCachedProfile(id))
        .filter((u): u is User => u !== undefined),
    [social],
  )

  const incoming = useMemo(
    () =>
      social.incomingRequestIds
        .map((id) => social.getCachedProfile(id))
        .filter((u): u is User => u !== undefined),
    [social],
  )

  const outgoing = useMemo(
    () =>
      social.outgoingRequestIds
        .map((id) => social.getCachedProfile(id))
        .filter((u): u is User => u !== undefined),
    [social],
  )

  return (
    <PanelShell title="Traders" onClose={social.close}>
      <div className="sticky top-0 z-10 flex gap-1 border-b border-border bg-background px-4 py-2">
        <TabButton active={tab === "search"} onClick={() => setTab("search")}>
          Find
        </TabButton>
        <TabButton active={tab === "requests"} onClick={() => setTab("requests")}>
          Requests
          {social.pendingFriendRequestCount > 0 ? (
            <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
              {social.pendingFriendRequestCount}
            </span>
          ) : null}
        </TabButton>
        <TabButton active={tab === "friends"} onClick={() => setTab("friends")}>
          Friends · {social.friendCount}
        </TabButton>
      </div>

      {!user && (
        <p className="p-4 text-sm text-muted-foreground">Sign in to find and add traders.</p>
      )}

      {tab === "search" && user && (
        <div className="p-4">
          <div className="relative mb-3">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or handle…"
              aria-label="Search for traders"
              className="h-11 w-full rounded-xl border border-border bg-secondary/60 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50 focus:bg-secondary"
            />
          </div>
          {searching ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : searchResults.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {searchResults.map((u) => (
                <TraderRow key={u.id} user={u} />
              ))}
            </ul>
          ) : query.trim() ? (
            <EmptyState label="No traders match your search." />
          ) : (
            <EmptyState label="Search by handle or display name to find collectors." />
          )}
        </div>
      )}

      {tab === "requests" && user && (
        <div className="space-y-6 p-4">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Incoming
            </h3>
            {incoming.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {incoming.map((u) => (
                  <RequestRow key={u.id} user={u} direction="incoming" />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No incoming friend requests.</p>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sent
            </h3>
            {outgoing.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {outgoing.map((u) => (
                  <RequestRow key={u.id} user={u} direction="outgoing" />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No pending outgoing requests.</p>
            )}
          </section>
        </div>
      )}

      {tab === "friends" && user && (
        <div className="p-4">
          {friends.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {friends.map((u) => (
                <TraderRow key={u.id} user={u} />
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

function TraderRow({ user }: { user: User }) {
  const social = useSocial()
  const { user: me } = useAuth()
  const status = social.friendshipStatus(user.id)
  const rating = social.ratingFor(user.id)
  const reviewCount = social.reviewsFor(user.id).length
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (me?.id === user.id) return null

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true)
    setError(null)
    try {
      const err = await action()
      if (err) setError(err)
    } catch {
      setError("Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <li>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-2.5">
          <button
            type="button"
            onClick={() => social.openProfile(user.id)}
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
          <FriendActionButton
            status={status}
            busy={busy}
            userName={user.name}
            onAdd={() => run(() => social.addFriend(user.id))}
            onAccept={() => run(() => social.acceptFriendRequest(user.id))}
            onDecline={() => run(() => social.declineFriendRequest(user.id))}
            onRemove={() => run(() => social.removeFriend(user.id))}
            onCancel={() => run(() => social.declineFriendRequest(user.id))}
          />
        </div>
        {error && <p className="px-1 text-[11px] text-destructive">{error}</p>}
      </div>
    </li>
  )
}

function RequestRow({
  user,
  direction,
}: {
  user: User
  direction: "incoming" | "outgoing"
}) {
  const social = useSocial()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true)
    setError(null)
    try {
      const err = await action()
      if (err) setError(err)
    } catch {
      setError("Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <li>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-2.5">
          <button
            type="button"
            onClick={() => social.openProfile(user.id)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <UserAvatar user={user} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{user.handle}</span>
            </span>
          </button>
          {direction === "incoming" ? (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => social.acceptFriendRequest(user.id))}
                className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-60"
                aria-label={`Accept ${user.name}`}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => social.declineFriendRequest(user.id))}
                className="flex size-10 items-center justify-center rounded-xl border border-border disabled:opacity-60"
                aria-label={`Decline ${user.name}`}
              >
                <UserX className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => social.declineFriendRequest(user.id))}
              className="flex shrink-0 items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Clock className="size-3" />}
              Cancel
            </button>
          )}
        </div>
        {error && <p className="px-1 text-[11px] text-destructive">{error}</p>}
      </div>
    </li>
  )
}

function FriendActionButton({
  status,
  busy,
  userName,
  onAdd,
  onAccept,
  onDecline,
  onRemove,
  onCancel,
}: {
  status: FriendshipStatus
  busy: boolean
  userName: string
  onAdd: () => void
  onAccept: () => void
  onDecline: () => void
  onRemove: () => void
  onCancel: () => void
}) {
  if (status === "pending_incoming") {
    return (
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation()
            onAccept()
          }}
          className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-60"
          aria-label={`Accept ${userName}`}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation()
            onDecline()
          }}
          className="flex size-10 items-center justify-center rounded-xl border border-border disabled:opacity-60"
          aria-label={`Decline ${userName}`}
        >
          <UserX className="size-4" />
        </button>
      </div>
    )
  }

  if (status === "pending_outgoing") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation()
          onCancel()
        }}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground disabled:opacity-60"
        aria-label={`Cancel friend request to ${userName}`}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
      </button>
    )
  }

  const isFriend = status === "accepted"

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation()
        if (isFriend) onRemove()
        else onAdd()
      }}
      aria-label={isFriend ? `Remove ${userName} from friends` : `Add ${userName} as a friend`}
      className={cn(
        "group flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        isFriend
          ? "border-trade/50 bg-trade/15 text-trade hover:border-destructive/50 hover:bg-destructive/15 hover:text-destructive"
          : "border-primary/50 bg-primary text-primary-foreground",
      )}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : isFriend ? (
        <>
          <UserCheck className="size-4 group-hover:hidden" aria-hidden="true" />
          <UserX className="hidden size-4 group-hover:block" aria-hidden="true" />
        </>
      ) : (
        <UserPlus className="size-4" aria-hidden="true" />
      )}
    </button>
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
        "relative flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
