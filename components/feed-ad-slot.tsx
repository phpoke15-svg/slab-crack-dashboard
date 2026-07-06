"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

type FeedAdSlotProps = {
  slotIndex: number
  className?: string
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[]
  }
}

export function FeedAdSlot({ slotIndex, className }: FeedAdSlotProps) {
  const pushed = useRef(false)
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
  const slotId = process.env.NEXT_PUBLIC_ADSENSE_FEED_SLOT_ID
  const adsEnabled = Boolean(clientId && slotId)

  useEffect(() => {
    if (!adsEnabled || pushed.current) return
    pushed.current = true
    try {
      window.adsbygoogle = window.adsbygoogle ?? []
      window.adsbygoogle.push({})
    } catch {
      /* ad blockers */
    }
  }, [adsEnabled])

  if (!adsEnabled) {
    return (
      <div
        role="complementary"
        aria-label={`Advertisement slot ${slotIndex}`}
        className={cn(
          "flex min-h-[100px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-secondary/20 px-4 py-6 text-center",
          className,
        )}
      >
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Sponsored
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Ad slot {slotIndex} · set{" "}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[10px]">
            NEXT_PUBLIC_ADSENSE_*
          </code>{" "}
          in .env.local
        </p>
      </div>
    )
  }

  return (
    <div
      role="complementary"
      aria-label="Advertisement"
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-secondary/10 px-2 py-2",
        className,
      )}
    >
      <p className="mb-1 text-center text-[9px] uppercase tracking-wider text-muted-foreground">
        Sponsored
      </p>
      <ins
        className="adsbygoogle block min-h-[90px] w-full"
        style={{ display: "block" }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
        data-adtest={process.env.NODE_ENV === "development" ? "on" : undefined}
      />
    </div>
  )
}
