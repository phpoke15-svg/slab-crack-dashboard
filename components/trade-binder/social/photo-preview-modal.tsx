"use client"

import Image from "next/image"
import { useEffect, useMemo } from "react"
import { Loader2, X } from "lucide-react"

export function PhotoPreviewModal({
  file,
  caption,
  onCaptionChange,
  onCancel,
  onSend,
  sending,
}: {
  file: File
  caption: string
  onCaptionChange: (value: string) => void
  onCancel: () => void
  onSend: () => void
  sending: boolean
}) {
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file])

  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Send card photo</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="flex size-8 items-center justify-center rounded-lg border border-border"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-xl bg-secondary">
          <Image src={previewUrl} alt="Preview" fill className="object-cover" unoptimized />
        </div>

        <input
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="Add a caption (optional)…"
          className="mt-3 w-full rounded-xl border border-border bg-secondary/60 px-3 py-2 text-sm outline-none focus:border-primary/50"
        />

        <button
          type="button"
          disabled={sending}
          onClick={onSend}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : null}
          Send photo
        </button>
      </div>
    </div>
  )
}
