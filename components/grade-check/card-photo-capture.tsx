"use client"

import { useRef } from "react"
import Image from "next/image"
import { Camera, ImagePlus, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type CardPhotoSlot = "front" | "back"

export type CardPhotos = {
  front: string | null
  back: string | null
}

type CardPhotoCaptureProps = {
  photos: CardPhotos
  onChange: (photos: CardPhotos) => void
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function PhotoSlot({
  label,
  hint,
  value,
  onPick,
  onClear,
}: {
  label: string
  hint: string
  value: string | null
  onPick: (file: File) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${label}`}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {value ? (
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/10 bg-black/40">
          <Image src={value} alt={label} fill className="object-contain" unoptimized />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border",
            "bg-secondary/40 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
          )}
        >
          <Camera className="size-6" />
          <span className="text-sm font-medium">Add photo</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (file) onPick(file)
          event.target.value = ""
        }}
      />

      {!value && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card/60 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ImagePlus className="size-3.5" />
          Upload from gallery
        </button>
      )}
    </div>
  )
}

export function CardPhotoCapture({ photos, onChange }: CardPhotoCaptureProps) {
  const setPhoto = async (slot: CardPhotoSlot, file: File) => {
    const dataUrl = await readFile(file)
    onChange({ ...photos, [slot]: dataUrl })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <PhotoSlot
        label="Front"
        hint="Required for centering"
        value={photos.front}
        onPick={(file) => setPhoto("front", file)}
        onClear={() => onChange({ ...photos, front: null })}
      />
      <PhotoSlot
        label="Back"
        hint="Optional — edges & surface"
        value={photos.back}
        onPick={(file) => setPhoto("back", file)}
        onClear={() => onChange({ ...photos, back: null })}
      />
    </div>
  )
}
