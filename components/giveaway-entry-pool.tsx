import { Users } from "lucide-react"
import type { GiveawayEntryPoolData } from "@/lib/giveaway/types"

type Props = {
  pool: GiveawayEntryPoolData
  liveTotal?: number
}

function formatMonthLabel(monthPeriod: string): string {
  const [year, month] = monthPeriod.split("-").map(Number)
  if (!year || !month) return monthPeriod
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function GiveawayEntryPool({ pool, liveTotal }: Props) {
  const total = liveTotal ?? pool.totalEntries
  const monthLabel = formatMonthLabel(pool.monthPeriod)

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Users className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Entries in this month&apos;s drawing
          </p>
          {pool.error ? (
            <p className="mt-2 text-sm text-destructive">{pool.error}</p>
          ) : (
            <>
              <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                {total.toLocaleString("en-US")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Total eligible entries earned so far for the {monthLabel} promotion period. Each entry row in
                the pool is one chance in the monthly drawing.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
