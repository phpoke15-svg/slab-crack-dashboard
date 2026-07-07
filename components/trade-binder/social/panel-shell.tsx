"use client"

import { useEffect, type ReactNode } from "react"
import { X } from "lucide-react"

/** Full-height sliding overlay panel constrained to the mobile column. */
export function PanelShell({
  title,
  onClose,
  children,
  headerAccessory,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  headerAccessory?: ReactNode
}) {
  // Lock body scroll while the panel is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <div className="absolute inset-x-0 bottom-0 top-0 mx-auto flex w-full max-w-md flex-col border-x-2 border-border bg-card">
        <header className="shrink-0 border-b-2 border-border">
          <div className="hazard-stripes h-1.5 w-full opacity-80" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <h2 className="font-serif text-xl font-bold uppercase tracking-widest text-card-foreground text-balance">
              {title}
            </h2>
            <div className="flex items-center gap-2">
              {headerAccessory}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="flex size-9 items-center justify-center rounded-xs border-2 border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>
        <div className="metal-grain min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
