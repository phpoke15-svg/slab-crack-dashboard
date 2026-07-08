"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  BookOpen,
  LogOut,
  MessageSquare,
  User,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useOptionalSocial } from "@/components/trade-binder/social/social-provider"

type SiteAuthButtonProps = {
  className?: string
}

function accountInitial(email?: string | null): string {
  const local = email?.split("@")[0]?.trim()
  if (!local) return "?"
  return local.slice(0, 1).toUpperCase()
}

function SocialNavTab({
  label,
  icon,
  badge,
  onClick,
  ariaLabel,
}: {
  label: string
  icon: ReactNode
  badge?: number
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="relative inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground sm:px-2.5"
    >
      <span className="relative flex size-4 items-center justify-center">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  )
}

export function SiteAuthButton({ className }: SiteAuthButtonProps) {
  const pathname = usePathname()
  const { user, isLoading, signOut } = useAuth()
  const social = useOptionalSocial()
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const signInHref = `/sign-in?next=${encodeURIComponent(pathname || "/")}`

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [menuOpen])

  if (isLoading) {
    return <span className={cn("inline-block size-9 rounded-xl bg-secondary/60", className)} aria-hidden="true" />
  }

  if (!user) {
    return (
      <Link
        href={signInHref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15",
          className,
        )}
      >
        Sign in
      </Link>
    )
  }

  const label = user.email?.split("@")[0] ?? "Account"

  return (
    <div ref={rootRef} className={cn("relative flex items-center gap-2", className)}>
      {social && (
        <nav
          aria-label="Social navigation"
          className="flex items-center rounded-xl border border-border bg-secondary/60 p-1"
        >
          <SocialNavTab
            label="Profile"
            icon={<User className="size-4" aria-hidden="true" />}
            onClick={() => social.openProfile(user.id)}
            ariaLabel="Open your profile"
          />
          <SocialNavTab
            label="Friends"
            icon={<Users className="size-4" aria-hidden="true" />}
            badge={social.friendCount}
            onClick={() => social.openFriends()}
            ariaLabel={`Friends (${social.friendCount})`}
          />
          <SocialNavTab
            label="Messages"
            icon={<MessageSquare className="size-4" aria-hidden="true" />}
            badge={social.pendingTradeCount}
            onClick={() => social.openMessages()}
            ariaLabel={`Messages (${social.pendingTradeCount} pending)`}
          />
        </nav>
      )}

      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-xs font-semibold text-primary">
          {accountInitial(user.email)}
        </span>
        <span className="hidden max-w-[100px] truncate sm:inline">{label}</span>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium text-foreground">{label}</p>
            {user.email && (
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>

          <Link
            href="/binder"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
          >
            <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
            My binder
          </Link>

          {social && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                social.openMessages()
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />
              Messages
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              void signOut()
            }}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
