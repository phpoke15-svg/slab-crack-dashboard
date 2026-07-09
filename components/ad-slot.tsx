"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  getAdSenseClientId,
  getAdSenseSlotId,
  type AdSenseSlotVariant,
} from "@/lib/adsense-config"

type AdSlotProps = {
  variant?: AdSenseSlotVariant
  /** For dev placeholders and aria labels when multiple ads share a page. */
  slotIndex?: number
  className?: string
  compact?: boolean
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[]
  }
}

export function AdSlot({
  variant = "feed",
  slotIndex = 1,
  className,
  compact = false,
}: AdSlotProps) {
  const pushed = useRef(false)
  const clientId = getAdSenseClientId()
  const slotId = getAdSenseSlotId(variant)
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
  }, [adsEnabled, slotId])

  if (!adsEnabled) {
    return (
      <div
        role="complementary"
        aria-label={`Advertisement slot ${slotIndex}`}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-secondary/20 px-4 text-center",
          compact ? "min-h-[72px] py-4" : "min-h-[100px] py-6",
          className,
        )}
      >
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Sponsored
        </p>
        {!compact && (
          <p className="mt-1 text-xs text-muted-foreground">
            {variant} slot · set{" "}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[10px]">
              NEXT_PUBLIC_ADSENSE_*
            </code>
          </p>
        )}
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
        className={cn("adsbygoogle block w-full", compact ? "min-h-[72px]" : "min-h-[90px]")}
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
