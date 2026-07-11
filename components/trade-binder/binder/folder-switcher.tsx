"use client"

import type { ReactNode } from "react"
import { ArrowLeftRight, Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CardStatus } from "@/lib/trade-binder/cards"

type FolderSwitcherProps = {
  status: CardStatus | null
  onSelect: (status: CardStatus) => void
  disabled?: boolean
  size?: "sm" | "md"
}

export function FolderSwitcher({ status, onSelect, disabled, size = "md" }: FolderSwitcherProps) {
  const compact = size === "sm"

  return (
    <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Move card between folders">
      <FolderButton
        label="I have"
        pressed={status === "trade"}
        disabled={disabled}
        compact={compact}
        onClick={() => onSelect("trade")}
        icon={<ArrowLeftRight className={cn(compact ? "size-3" : "size-3.5")} aria-hidden="true" />}
      />
      <FolderButton
        label="I want"
        pressed={status === "wishlist"}
        disabled={disabled}
        compact={compact}
        onClick={() => onSelect("wishlist")}
        icon={
          <Heart
            className={cn(compact ? "size-3" : "size-3.5", status === "wishlist" && "fill-current")}
            aria-hidden="true"
          />
        }
      />
    </div>
  )
}

function FolderButton({
  label,
  icon,
  pressed,
  disabled,
  compact,
  onClick,
}: {
  label: string
  icon: ReactNode
  pressed: boolean
  disabled?: boolean
  compact: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-lg border font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        compact ? "px-1.5 py-1.5 text-[10px]" : "px-2 py-2 text-xs",
        pressed
          ? "border-primary/50 bg-primary/15 text-foreground"
          : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/35 hover:bg-secondary hover:text-foreground",
      )}
    >
      <span className="text-primary">{icon}</span>
      {label}
    </button>
  )
}
