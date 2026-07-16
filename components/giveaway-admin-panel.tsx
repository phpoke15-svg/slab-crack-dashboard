"use client"

import { useState } from "react"
import { Loader2, Mail } from "lucide-react"

export function GiveawayAdminPanel() {
  const [user, setUser] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setLoading(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/giveaway/mail-in", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.trim(), notes }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        entriesAdded?: number
        reason?: string
      }
      if (!res.ok || !json.ok) {
        throw new Error(json.error || json.reason || "Mail-in failed")
      }
      setMessage(`Added ${json.entriesAdded ?? 0} entries for ${user.trim()}`)
      setUser("")
      setNotes("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mail-in failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Giveaway — AMOE mail-in</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Process a postcard: 7 entries each, max 4/month per user, 28/month total cap.
      </p>
      <div className="space-y-2">
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="User handle or UUID"
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
        />
        <button
          type="button"
          disabled={loading || !user.trim()}
          onClick={() => void submit()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          Credit 7 entries
        </button>
        {message ? <p className="text-xs text-primary">{message}</p> : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </section>
  )
}
