"use client"

import { Loader2, Search, X } from "lucide-react"

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
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary"
        aria-hidden="true"
      />
      <input
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="SEARCH POKEMON CARDS..."
        aria-label="Search Pokemon cards by name or set"
        className="h-11 w-full rounded-xs border-2 border-border bg-input pl-10 pr-10 font-mono text-sm uppercase tracking-wider text-foreground placeholder:text-muted-foreground placeholder:tracking-widest focus-visible:border-primary focus-visible:outline-none"
      />
      {isLoading && (
        <Loader2
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary"
          aria-hidden="true"
        />
      )}
      {value.length > 0 && !isLoading && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
