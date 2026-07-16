"use client"

import { useState } from "react"
import { Check, ThumbsDown, ThumbsUp } from "lucide-react"
import { cn } from "@/lib/utils"

export type ScanMatchFeedbackProps = {
  scanMode: "single" | "multi"
  cardId?: string | null
  cardName?: string | null
  setName?: string | null
  cardNumber?: string | null
  matchMethod?: "visual_phash" | "vision" | null
  matchScore?: number | null
  batchIndex?: number
  compact?: boolean
  className?: string
  onWrong?: () => void
}

export function ScanMatchFeedback({
  scanMode,
  cardId,
  cardName,
  setName,
  cardNumber,
  matchMethod,
  matchScore,
  batchIndex,
  compact = false,
  className,
  onWrong,
}: ScanMatchFeedbackProps) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle")
  const [picked, setPicked] = useState<"right" | "wrong" | null>(null)

  const submit = async (correct: boolean) => {
    if (state !== "idle") return
    setState("sending")
    setPicked(correct ? "right" : "wrong")

    try {
      await fetch("/api/scanner/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          correct,
          scanMode,
          presentedCardId: cardId,
          cardName,
          setName,
          cardNumber,
          matchMethod,
          matchScore,
          batchIndex,
        }),
      })
    } catch {
      /* still thank the user — feedback is best-effort */
    }

    setState("done")
    if (!correct) onWrong?.()
  }

  if (state === "done") {
    return (
      <p
        className={cn(
          "flex items-center gap-1 text-white/55",
          compact ? "text-[10px]" : "text-[11px]",
          className,
        )}
      >
        <Check className={cn(compact ? "size-3" : "size-3.5", "text-primary")} />
        Thanks — helps us improve scans
      </p>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        compact ? "text-[10px]" : "text-[11px]",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span className="text-white/55">Right card?</span>
      <button
        type="button"
        disabled={state === "sending"}
        onClick={() => void submit(true)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 font-medium text-white hover:bg-white/10 disabled:opacity-50",
          compact ? "px-1.5 py-0.5" : "px-2 py-1",
          picked === "right" && state === "sending" && "border-primary/40 bg-primary/15",
        )}
      >
        <ThumbsUp className={compact ? "size-3" : "size-3.5"} />
        Right
      </button>
      <button
        type="button"
        disabled={state === "sending"}
        onClick={() => void submit(false)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 font-medium text-white hover:bg-white/10 disabled:opacity-50",
          compact ? "px-1.5 py-0.5" : "px-2 py-1",
          picked === "wrong" && state === "sending" && "border-amber-400/40 bg-amber-400/10",
        )}
      >
        <ThumbsDown className={compact ? "size-3" : "size-3.5"} />
        Wrong
      </button>
    </div>
  )
}
