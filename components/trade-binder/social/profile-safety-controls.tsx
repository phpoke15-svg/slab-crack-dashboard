"use client"

import { useState } from "react"
import { Ban, Flag, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/trade-binder/blocks"
import { useSocial } from "./social-provider"

type ProfileSafetyControlsProps = {
  userId: string
  userName: string
  className?: string
}

export function ProfileSafetyControls({ userId, userName, className }: ProfileSafetyControlsProps) {
  const social = useSocial()
  const [busy, setBusy] = useState<"block" | "report" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>("harassment")
  const [details, setDetails] = useState("")
  const [reportSent, setReportSent] = useState(false)

  const iBlocked = social.isBlocked(userId)

  const runBlock = async () => {
    setBusy("block")
    setError(null)
    try {
      const err = iBlocked ? await social.unblockUser(userId) : await social.blockUser(userId)
      if (err) setError(err)
    } catch {
      setError("Something went wrong")
    } finally {
      setBusy(null)
    }
  }

  const submitReport = async () => {
    setBusy("report")
    setError(null)
    try {
      const err = await social.reportUser(userId, reason, details)
      if (err) {
        setError(err)
        return
      }
      setReportSent(true)
      setReportOpen(false)
      setDetails("")
    } catch {
      setError("Could not submit report")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void runBlock()}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 sm:flex-none",
            iBlocked
              ? "border-border bg-secondary/40 text-foreground"
              : "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          {busy === "block" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Ban className="size-4" />
          )}
          {iBlocked ? "Unblock" : "Block"}
        </button>
        <button
          type="button"
          disabled={busy !== null || reportSent}
          onClick={() => {
            setReportOpen((v) => !v)
            setError(null)
          }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 disabled:opacity-60 sm:flex-none"
        >
          <Flag className="size-4" />
          {reportSent ? "Reported" : "Report"}
        </button>
      </div>

      {reportOpen && !reportSent && (
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <p className="text-xs font-medium text-foreground">Report {userName}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Reports are reviewed. Abuse of reporting may result in account action.
          </p>
          <label className="mt-3 block text-xs font-medium text-muted-foreground">
            Reason
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-secondary/60 px-2 text-sm text-foreground"
            >
              {(Object.entries(REPORT_REASON_LABELS) as [ReportReason, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="mt-3 block text-xs font-medium text-muted-foreground">
            Details (optional)
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What happened?"
              className="mt-1 w-full resize-none rounded-lg border border-border bg-secondary/60 p-2 text-sm text-foreground"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy === "report"}
              onClick={() => void submitReport()}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy === "report" ? "Sending…" : "Submit report"}
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {reportSent && (
        <p className="text-xs text-muted-foreground">
          Thanks — we received your report about {userName}.
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
