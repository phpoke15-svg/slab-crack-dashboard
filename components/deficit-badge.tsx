import { cn } from "@/lib/utils"
import { TrendingDown } from "lucide-react"

interface DeficitBadgeProps {
  diff: number
  pct: number
  size?: "sm" | "lg"
  glow?: boolean
}

export function DeficitBadge({ diff, pct, size = "sm", glow = true }: DeficitBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-col items-end rounded-xl border border-primary/30 bg-primary/10 text-primary",
        size === "sm" ? "px-3 py-1.5" : "px-4 py-2.5",
        glow && "shadow-[0_0_20px_-4px] shadow-primary/40",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1 font-mono font-semibold tabular-nums leading-none",
          size === "sm" ? "text-sm" : "text-2xl",
        )}
      >
        <TrendingDown className={size === "sm" ? "size-3.5" : "size-5"} strokeWidth={2.5} />
        {"-$"}
        {Math.abs(diff).toFixed(2)}
      </span>
      <span className={cn("mt-0.5 font-medium text-primary/70", size === "sm" ? "text-[11px]" : "text-xs")}>
        {Math.abs(pct).toFixed(0)}
        {"% off raw"}
      </span>
    </div>
  )
}
