"use client"

import { useEffect, useState } from "react"
import { Bell, Loader2 } from "lucide-react"
import {
  enableWebPush,
  getPushPermission,
  hasActivePushSubscription,
  isWebPushSupported,
} from "@/lib/push/client"

export function GiveawayReminderOptIn() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [supported, setSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setSupported(isWebPushSupported())
      try {
        const res = await fetch("/api/giveaway/reminders", { credentials: "same-origin" })
        const json = (await res.json()) as {
          ok?: boolean
          enabled?: boolean
          pushConfigured?: boolean
          error?: string
        }
        if (!cancelled && json.ok) {
          setEnabled(Boolean(json.enabled))
          setSupported(isWebPushSupported() && Boolean(json.pushConfigured))
        }
      } catch {
        if (!cancelled) setError("Could not load reminder settings")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = async () => {
    setSaving(true)
    setError(null)

    try {
      const next = !enabled

      if (next) {
        const permission = await getPushPermission()
        const hasPush = await hasActivePushSubscription()

        if (permission !== "granted" || !hasPush) {
          const pushResult = await enableWebPush({ giveawayReminders: true })
          if (!pushResult.ok) {
            setError(pushResult.error)
            return
          }
        }
      }

      const res = await fetch("/api/giveaway/reminders", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        enabled?: boolean
        error?: string
        needsPushSubscription?: boolean
      }

      if (!res.ok || !json.ok) {
        setError(json.error || "Could not update reminder settings")
        return
      }

      setEnabled(Boolean(json.enabled))
    } catch {
      setError("Could not update reminder settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null
  if (!supported) return null

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Bell className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Daily entry reminders</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Optional push notification if you have not earned today&apos;s free giveaway entry yet.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void toggle()}
          aria-pressed={enabled}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            enabled
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-background text-foreground hover:bg-muted"
          }`}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : enabled ? "On" : "Off"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </section>
  )
}
