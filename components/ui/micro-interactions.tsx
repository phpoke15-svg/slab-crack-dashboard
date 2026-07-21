"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { usePriceFlash } from "@/hooks/use-price-flash"

export function AnimatedPrice({
  value,
  formatted,
  refreshTrigger,
  className,
  flashClassName = "text-emerald-400 bg-emerald-950/40 rounded px-0.5 -mx-0.5",
}: {
  value: number
  formatted: string
  refreshTrigger?: string | null
  className?: string
  flashClassName?: string
}) {
  const flashing = usePriceFlash(value, { refreshTrigger })

  return (
    <span
      className={cn(
        "inline-block transition-[color,background-color,opacity] duration-300 ease-out",
        className,
        flashing && flashClassName,
      )}
    >
      {formatted}
    </span>
  )
}

const CONDITION_TOOLTIPS: Record<string, string> = {
  "Raw NM": "Ungraded near-mint market price",
  "PSA 10": "PSA gem mint graded slab price",
  "Rare Holo": "Rare holofoil print variant",
  Market: "Current market estimate",
}

export function ConditionBadge({
  label,
  tip,
  className,
  children,
}: {
  label?: string
  tip?: string
  className?: string
  children?: ReactNode
}) {
  const text = label ?? (typeof children === "string" ? children : "")
  const tooltip = tip ?? CONDITION_TOOLTIPS[text] ?? text

  return (
    <span className="group/condition relative inline-flex max-w-full">
      <span className={cn("cursor-default", className)}>{children ?? label}</span>
      {tooltip ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 max-w-[12rem] -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-center text-[10px] leading-snug text-popover-foreground opacity-0 shadow-md transition-opacity duration-100 group-hover/condition:opacity-100"
        >
          {tooltip}
        </span>
      ) : null}
    </span>
  )
}

export function StaggerGridItem({
  index,
  children,
  className,
  as: Tag = "li",
}: {
  index: number
  children: ReactNode
  className?: string
  as?: "li" | "div"
}) {
  return (
    <Tag
      className={cn("animate-stagger-fade-in opacity-0", className)}
      style={{ animationDelay: `${Math.min(index, 24) * 30}ms` }}
    >
      {children}
    </Tag>
  )
}
