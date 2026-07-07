"use client"

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
  const pad = size === "sm" ? "py-1.5 text-[10px]" : "py-2 text-xs"

  return (
    <div
      className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/40 p-0.5"
      role="group"
      aria-label="Move card between folders"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect("trade")}
        aria-pressed={status === "trade"}
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          pad,
          status === "trade"
            ? "bg-trade/25 text-trade shadow-sm"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <ArrowLeftRight className="size-3" aria-hidden="true" />
        I have
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect("wishlist")}
        aria-pressed={status === "wishlist"}
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          pad,
          status === "wishlist"
            ? "bg-wishlist/25 text-wishlist shadow-sm"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <Heart className={cn("size-3", status === "wishlist" && "fill-current")} aria-hidden="true" />
        I want
      </button>
    </div>
  )
}
