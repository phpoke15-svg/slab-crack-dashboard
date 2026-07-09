"use client"

import { useEffect, type ReactNode } from "react"
import { X } from "lucide-react"

export function PanelShell({
  title,
  onClose,
  children,
  headerAccessory,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  headerAccessory?: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mx-auto flex h-full w-full max-w-3xl flex-col border-x border-border bg-background shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="shrink-0 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-foreground text-balance">{title}</h2>
            <div className="flex items-center gap-2">
              {headerAccessory}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="flex size-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer ? (
            <div className="shrink-0 border-t border-border bg-background">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
