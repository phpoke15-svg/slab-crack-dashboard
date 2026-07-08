"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import type { User } from "@/lib/trade-binder/users"

const sizeMap = {
  sm: { box: "size-9", px: "36px", text: "text-xs" },
  md: { box: "size-12", px: "48px", text: "text-sm" },
  lg: { box: "size-20", px: "80px", text: "text-xl" },
} as const

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function UserAvatar({
  user,
  size = "md",
  className,
}: {
  user: User
  size?: keyof typeof sizeMap
  className?: string
}) {
  const { box, px, text } = sizeMap[size]
  const label = user.name || user.handle

  if (user.avatar) {
    return (
      <span
        className={cn(
          "relative inline-block shrink-0 overflow-hidden rounded-xl border border-border bg-muted",
          box,
          className,
        )}
      >
        <Image src={user.avatar} alt={`${label}'s avatar`} fill sizes={px} className="object-cover" />
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl border border-border bg-primary/15 font-semibold text-primary",
        box,
        text,
        className,
      )}
      aria-hidden="true"
    >
      {initials(label)}
    </span>
  )
}
