"use client"

import { useCallback, useState } from "react"
import { BellRing, Loader2, Send } from "lucide-react"
import { cn } from "@/lib/utils"

type BroadcastResult = {
  ok: boolean
  sent?: number
  failed?: number
  audience?: number
  skipped?: boolean
  reason?: string
  title?: string
  body?: string
  url?: string
  sentAt?: string
  error?: string
}

type ChatLine = {
  id: string
  kind: "out" | "status"
  title?: string
  body: string
  at: string
  meta?: string
}

export function SupremeBroadcastPanel({
  pushOptIns,
  webPushConfigured,
}: {
  pushOptIns: number | null
  webPushConfigured: boolean | string | null
}) {
  const [title, setTitle] = useState("CollecTools")
  const [message, setMessage] = useState("")
  const [url, setUrl] = useState("/")
  const [sending, setSending] = useState(false)
  const [lines, setLines] = useState<ChatLine[]>([])

  const pushLine = useCallback((line: Omit<ChatLine, "id">) => {
    setLines((prev) => [
      ...prev,
      { ...line, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
    ])
  }, [])

  const send = useCallback(async () => {
    const body = message.trim()
    if (!body || sending) return

    const confirmed = window.confirm(
      `Send this notification to all ${pushOptIns ?? "opted-in"} web-push subscribers?`,
    )
    if (!confirmed) return

    setSending(true)
    pushLine({
      kind: "out",
      title: title.trim() || "CollecTools",
      body,
      at: new Date().toISOString(),
    })

    try {
      const res = await fetch("/api/supreme/broadcast", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "CollecTools",
          body,
          url: url.trim() || "/",
        }),
      })
      const data = (await res.json().catch(() => ({}))) as BroadcastResult
      if (!res.ok) {
        pushLine({
          kind: "status",
          body: data.error || `Send failed (${res.status})`,
          at: new Date().toISOString(),
        })
        return
      }

      if (data.skipped) {
        pushLine({
          kind: "status",
          body: `Skipped: ${data.reason ?? "unknown"}`,
          at: data.sentAt ?? new Date().toISOString(),
        })
        return
      }

      pushLine({
        kind: "status",
        body: `Delivered to ${data.sent ?? 0} of ${data.audience ?? 0} devices` +
          (data.failed ? ` · ${data.failed} failed` : ""),
        at: data.sentAt ?? new Date().toISOString(),
        meta: data.url,
      })
      setMessage("")
    } catch (err) {
      pushLine({
        kind: "status",
        body: err instanceof Error ? err.message : "Network error",
        at: new Date().toISOString(),
      })
    } finally {
      setSending(false)
    }
  }, [message, sending, pushOptIns, pushLine, title, url])

  const pushReady = webPushConfigured !== false
  const statusLabel =
    webPushConfigured === true
      ? "Web push ready"
      : webPushConfigured === false
        ? "VAPID missing"
        : "Checking…"
  const statusClass =
    webPushConfigured === true
      ? "bg-primary/15 text-primary"
      : webPushConfigured === false
        ? "bg-destructive/15 text-destructive"
        : "bg-secondary text-muted-foreground"

  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <BellRing className="size-3.5 text-primary" aria-hidden />
            Broadcast notifications
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Supreme-only chat box. Sends a web push to everyone who turned on
            browser/phone alerts on the site ({pushOptIns ?? "—"} opt-ins). Does not
            reach the native Play/App Store app (local alerts only there).
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
            statusClass,
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 flex max-h-64 flex-col gap-2 overflow-y-auto rounded-xl border border-border/70 bg-background/70 p-3">
        {lines.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No broadcasts this session yet. Write a message below and hit send.
          </p>
        ) : (
          lines.map((line) => (
            <div
              key={line.id}
              className={cn(
                "max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                line.kind === "out"
                  ? "ml-auto bg-primary/20 text-foreground"
                  : "mr-auto border border-border bg-secondary/40 text-muted-foreground",
              )}
            >
              {line.title ? (
                <p className="font-semibold text-foreground">{line.title}</p>
              ) : null}
              <p className={line.title ? "mt-0.5" : undefined}>{line.body}</p>
              <p className="mt-1 text-[10px] opacity-70">
                {new Date(line.at).toLocaleTimeString()}
                {line.meta ? ` · ${line.meta}` : ""}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          placeholder="Notification title"
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
          disabled={!pushReady || sending}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value.slice(0, 200))}
          placeholder="Tap opens… (/ or path)"
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50 sm:min-w-[10rem]"
          disabled={!pushReady || sending}
        />
      </div>

      <div className="mt-2 flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 280))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder="Message to every opted-in device…"
          rows={3}
          className="min-h-[5.5rem] flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
          disabled={!pushReady || sending}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!pushReady || sending || !message.trim()}
          className="inline-flex h-auto min-w-12 flex-col items-center justify-center gap-1 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
          title="Send broadcast (Ctrl/⌘+Enter)"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          <span className="text-[10px] uppercase tracking-wide">Send</span>
        </button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {message.length}/280 · Ctrl/⌘+Enter to send · 15s cooldown between broadcasts
      </p>
    </section>
  )
}
