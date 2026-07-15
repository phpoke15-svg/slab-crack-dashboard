"use client"

import { Bookmark, BookmarkCheck } from "lucide-react"
import { cn } from "@/lib/utils"

type SaveForLaterButtonProps = {
  saved: boolean
  onToggle: () => void
  compact?: boolean
  className?: string
}

export function SaveForLaterButton({
  saved,
  onToggle,
  compact = false,
  className,
}: SaveForLaterButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved for later" : "Save for later"}
      title={saved ? "Saved for later" : "Save for later"}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border transition-colors",
        compact ? "size-8" : "gap-1.5 px-3 py-2 text-xs font-semibold",
        saved
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className,
      )}
    >
      {saved ? <BookmarkCheck className={compact ? "size-4" : "size-3.5"} /> : <Bookmark className={compact ? "size-4" : "size-3.5"} />}
      {!compact ? <span>{saved ? "Saved" : "Save for later"}</span> : null}
    </button>
  )
}
