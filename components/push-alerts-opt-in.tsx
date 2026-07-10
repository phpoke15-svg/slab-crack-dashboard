"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, BellOff, Loader2, Smartphone } from "lucide-react"
import {
  disableWebPush,
  enableWebPush,
  getPushPermission,
  hasActivePushSubscription,
  isWebPushSupported,
} from "@/lib/push/client"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** Highlight queue vs Walmart depending on page context */
  defaultQueueLive?: boolean
  defaultWalmartWednesday?: boolean
  compact?: boolean
}

export function PushAlertsOptIn({
  className,
  defaultQueueLive = true,
  defaultWalmartWednesday = true,
  compact = false,
}: Props) {
  const [supported, setSupported] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queueLive, setQueueLive] = useState(defaultQueueLive)
  const [walmartWednesday, setWalmartWednesday] = useState(defaultWalmartWednesday)

  const refresh = useCallback(async () => {
    setSupported(isWebPushSupported())
    const permission = await getPushPermission()
    if (permission === "unsupported") {
      setSupported(false)
      setEnabled(false)
      return
    }
    setEnabled(await hasActivePushSubscription())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onEnable = async () => {
    setBusy(true)
    setError(null)
    const result = await enableWebPush({ queueLive, walmartWednesday })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setEnabled(true)
  }

  const onDisable = async () => {
    setBusy(true)
    setError(null)
    await disableWebPush()
    setBusy(false)
    setEnabled(false)
  }

  if (!supported) {
    return (
      <section className={cn("rounded-2xl border border-border bg-card/60 p-5", className)}>
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Smartphone className="size-4" />
          Phone alerts
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Web Push isn&apos;t available in this browser. On iPhone/iPad: Safari → Share → Add to Home
          Screen, open CollecTools from the icon, then enable alerts here.
        </p>
      </section>
    )
  }

  return (
    <section className={cn("rounded-2xl border border-border bg-card/60 p-5", className)}>
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {enabled ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4" />}
        Phone alerts
      </p>
      {!compact && (
        <p className="mt-2 text-sm text-muted-foreground">
          Get a push notification on this device when Pokémon Center&apos;s queue goes live, and every
          Wednesday at 9:00 PM ET for Walmart sealed restocks. No Discord account needed.
        </p>
      )}

      {!enabled && (
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={queueLive}
              onChange={(e) => setQueueLive(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Pokémon Center queue live
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={walmartWednesday}
              onChange={(e) => setWalmartWednesday(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Walmart Wednesday 9pm ET
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {enabled ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDisable()}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <BellOff className="size-4" />}
            Turn off phone alerts
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || (!queueLive && !walmartWednesday)}
            onClick={() => void onEnable()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
            Enable phone alerts
          </button>
        )}
      </div>

      {enabled && (
        <p className="mt-3 text-xs font-medium text-trade">Enabled on this device</p>
      )}
      {error && (
        <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
