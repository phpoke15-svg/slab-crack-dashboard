"use client"

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

type WatchlistButtonProps = {
  watched: boolean
  onToggle: () => void
  compact?: boolean
  className?: string
}

export function WatchlistButton({
  watched,
  onToggle,
  compact = false,
  className,
}: WatchlistButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      aria-pressed={watched}
      aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
      title={watched ? "On watchlist" : "Add to watchlist"}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border transition-colors",
        compact ? "size-8" : "gap-1.5 px-3 py-2 text-xs font-semibold",
        watched
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className,
      )}
    >
      <Star className={cn(compact ? "size-4" : "size-3.5", watched && "fill-primary")} />
      {!compact ? <span>{watched ? "Watching" : "Watchlist"}</span> : null}
    </button>
  )
}
