"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Loader2, PlayCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { isRewardedAdConfigured } from "@/lib/ads/rewarded-ad-config"

type RewardedAdButtonProps = {
  userId: string
  minutesPerWatch: number
  disabled?: boolean
  disabledReason?: string
  onRewardRecorded?: () => void
  className?: string
}

type GoogletagRewardedEvent = {
  makeRewardedVisible?: () => void
  payload?: { amount?: number; type?: string }
}

declare global {
  interface Window {
    googletag?: {
      cmd: Array<() => void>
      enums: { OutOfPageFormat: { REWARDED: unknown } }
      defineOutOfPageSlot: (path: string, format: unknown) => {
        addService: (service: unknown) => unknown
      }
      pubads: () => {
        addEventListener: (event: string, cb: (event: GoogletagRewardedEvent) => void) => void
        setPublisherProvidedId: (id: string) => void
      }
      display: (slot: unknown) => void
      enableServices: () => void
    }
  }
}

function loadGptScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.googletag?.cmd) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-collectools-gpt="true"]')
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("GPT failed to load")))
      return
    }

    window.googletag = window.googletag || { cmd: [] }
    const script = document.createElement("script")
    script.async = true
    script.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js"
    script.dataset.collectoolsGpt = "true"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("GPT failed to load"))
    document.head.appendChild(script)
  })
}

export function GiveawayRewardedAdButton({
  userId,
  minutesPerWatch,
  disabled = false,
  disabledReason,
  onRewardRecorded,
  className,
}: RewardedAdButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rewardedRef = useRef(false)
  const adConfigured = isRewardedAdConfigured()

  const recordReward = useCallback(async () => {
    if (rewardedRef.current) return
    rewardedRef.current = true

    const response = await fetch("/api/ads/record-completed-ad", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const json = (await response.json().catch(() => null)) as {
      ok?: boolean
      error?: string
      reason?: string
    } | null

    if (!response.ok || !json?.ok) {
      rewardedRef.current = false
      throw new Error(json?.error || json?.reason || "Could not record ad reward")
    }

    onRewardRecorded?.()
  }, [onRewardRecorded])

  const showRewardedAd = useCallback(async () => {
    if (disabled || loading) return
    if (!adConfigured) {
      setError("Rewarded ads are not configured yet.")
      return
    }

    setError(null)
    setLoading(true)
    rewardedRef.current = false

    try {
      await loadGptScript()
      const adUnit = process.env.NEXT_PUBLIC_GAM_REWARDED_AD_UNIT?.trim()
      if (!adUnit || !window.googletag) {
        throw new Error("Rewarded ad slot unavailable")
      }

      await new Promise<void>((resolve, reject) => {
        let settled = false
        const finish = (fn: () => void) => {
          if (settled) return
          settled = true
          fn()
        }

        window.googletag!.cmd.push(() => {
          try {
            const googletag = window.googletag!
            googletag.pubads().setPublisherProvidedId(userId)

            const slot = googletag.defineOutOfPageSlot(
              adUnit,
              googletag.enums.OutOfPageFormat.REWARDED,
            )
            if (!slot) {
              finish(() => reject(new Error("Rewarded ad slot unavailable")))
              return
            }

            slot.addService(googletag.pubads())

            const onGranted = async () => {
              try {
                await recordReward()
                finish(() => resolve())
              } catch (err) {
                finish(() => reject(err))
              }
            }

            const onReady = (event: GoogletagRewardedEvent) => {
              event.makeRewardedVisible?.()
            }

            const onClosed = () => {
              finish(() => resolve())
            }

            googletag.pubads().addEventListener("rewardedSlotGranted", onGranted)
            googletag.pubads().addEventListener("rewardedSlotReady", onReady)
            googletag.pubads().addEventListener("rewardedSlotClosed", onClosed)
            googletag.enableServices()
            googletag.display(slot)
          } catch (err) {
            finish(() => reject(err))
          }
        })
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ad could not be shown")
    } finally {
      setLoading(false)
    }
  }, [adConfigured, disabled, loading, recordReward, userId])

  useEffect(() => {
    rewardedRef.current = false
  }, [userId])

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={() => void showRewardedAd()}
        disabled={disabled || loading || !adConfigured}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors",
          "hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading ad…
          </>
        ) : (
          <>
            <PlayCircle className="size-4" aria-hidden="true" />
            Watch Ad (-{minutesPerWatch} Mins)
          </>
        )}
      </button>
      {disabled && disabledReason ? (
        <p className="text-center text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
      {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}
      {!adConfigured && !disabled ? (
        <p className="text-center text-[10px] text-muted-foreground">
          Set <code className="text-[10px]">NEXT_PUBLIC_GAM_REWARDED_AD_UNIT</code> in Vercel to
          enable rewarded ads.
        </p>
      ) : null}
    </div>
  )
}
