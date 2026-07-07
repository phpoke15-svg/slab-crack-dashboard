import Image from "next/image"
import { cn } from "@/lib/utils"
import type { User } from "@/lib/trade-binder/users"

const sizeMap = {
  sm: { box: "size-9", px: "36px" },
  md: { box: "size-12", px: "48px" },
  lg: { box: "size-20", px: "80px" },
} as const

export function UserAvatar({
  user,
  size = "md",
  className,
}: {
  user: User
  size?: keyof typeof sizeMap
  className?: string
}) {
  const { box, px } = sizeMap[size]
  return (
    <span
      className={cn(
        "relative inline-block shrink-0 overflow-hidden rounded-xs border-2 border-border bg-muted",
        box,
        className,
      )}
    >
      <Image src={user.avatar || "/placeholder.svg"} alt={`${user.name}'s avatar`} fill sizes={px} className="object-cover" />
    </span>
  )
}
