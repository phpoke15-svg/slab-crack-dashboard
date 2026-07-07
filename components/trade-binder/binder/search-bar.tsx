"use client"

import { Loader2, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function SearchBar({
  value,
  onChange,
  isLoading,
}: {
  value: string
  onChange: (value: string) => void
  isLoading?: boolean
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search cards by name or set…"
        aria-label="Search cards by name or set"
        className={cn(
          "h-11 w-full rounded-xl border border-border bg-secondary/60 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground",
          "outline-none transition-colors focus:border-primary/50 focus:bg-secondary",
        )}
      />
      {isLoading && (
        <Loader2
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary"
          aria-hidden="true"
        />
      )}
      {value.length > 0 && !isLoading && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
