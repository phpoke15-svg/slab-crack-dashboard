"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

const sizeMap = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-7",
} as const

/** Read-only star display supporting fractional fills. */
export function StarRating({
  value,
  size = "sm",
  className,
}: {
  value: number
  size?: keyof typeof sizeMap
  className?: string
}) {
  const cls = sizeMap[size]
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i))
        return (
          <span key={i} className="relative inline-block">
            <Star className={cn(cls, "text-border")} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn(cls, "fill-primary text-primary")} />
            </span>
          </span>
        )
      })}
    </span>
  )
}

/** Interactive 1-5 star picker. */
export function StarInput({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className={cn("size-7", n <= shown ? "fill-primary text-primary" : "text-border")} />
        </button>
      ))}
    </div>
  )
}
