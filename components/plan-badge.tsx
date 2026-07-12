import { cn } from "@/lib/utils"
import { planDisplayName, type PlanId } from "@/lib/billing/plans"

const STYLES: Record<PlanId, string> = {
  free: "border-border/80 bg-secondary/60 text-muted-foreground",
  premium: "border-sky-500/35 bg-sky-500/15 text-sky-200",
  pro: "border-primary/40 bg-primary/15 text-primary",
  supreme: "border-amber-400/45 bg-amber-400/15 text-amber-200",
}

export function PlanBadge({
  plan,
  className,
}: {
  plan: PlanId
  className?: string
}) {
  const id = plan in STYLES ? plan : "free"
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
        STYLES[id],
        className,
      )}
    >
      {planDisplayName(id)}
    </span>
  )
}
