"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Gift } from "lucide-react"
import { useOptionalEntitlements } from "@/components/billing/entitlements-provider"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { cn } from "@/lib/utils"

const PING_MINUTES = 1
const PING_MS = 60_000

type Status = {
  monthEntries: number
  monthEntriesRemaining: number
  monthlyCap: number
  todayActiveMinutes: number
  todayEntryAwarded: boolean
  thresholdMinutes: number
  isPremium: boolean
}

export function GiveawayTracker() {
  const { user } = useAuth()
  const entitlements = useOptionalEntitlements()
  const [status, setStatus] = useState<Status | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const visibleRef = useRef(true)

  const refreshStatus = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch("/api/giveaway/status", { credentials: "same-origin" })
      const json = (await res.json()) as { ok?: boolean; status?: Status }
      if (json.ok && json.status) setStatus(json.status)
    } catch {
      /* silent */
    }
  }, [user])

  const ping = useCallback(async () => {
    if (!user || !visibleRef.current) return
    try {
      const res = await fetch("/api/giveaway/activity", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: PING_MINUTES }),
      })
      const json = (await res.json()) as { ok?: boolean; awarded?: boolean; entriesAdded?: number }
      if (json.ok && json.awarded) {
        setToast(`+${json.entriesAdded ?? 1} giveaway entries earned today!`)
        window.setTimeout(() => setToast(null), 5000)
        void refreshStatus()
      }
    } catch {
      /* silent */
    }
  }, [user, refreshStatus])

  useEffect(() => {
    if (!user) return
    void refreshStatus()
    const onVis = () => {
      visibleRef.current = document.visibilityState === "visible"
    }
    document.addEventListener("visibilitychange", onVis)
    const timer = window.setInterval(() => void ping(), PING_MS)
    return () => {
      document.removeEventListener("visibilitychange", onVis)
      window.clearInterval(timer)
    }
  }, [user, ping, refreshStatus])

  if (!user || !entitlements?.supreme || !status) return null

  return (
    <>
      {toast ? (
        <div
          className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/40 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg"
          role="status"
        >
          <Gift className="size-4" aria-hidden />
          {toast}
        </div>
      ) : null}
      <a
        href="/giveaway"
        className={cn(
          "fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-2 text-xs font-medium text-foreground shadow-md backdrop-blur-sm",
          "hover:bg-accent",
        )}
        title="Monthly giveaway entries"
      >
        <Gift className="size-4 text-primary" aria-hidden />
        <span>
          {status.monthEntries}/{status.monthlyCap} entries
        </span>
      </a>
    </>
  )
}
