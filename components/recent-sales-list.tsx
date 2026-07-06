import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RecentSale } from "@/lib/slab-data"

interface RecentSalesListProps {
  title: string
  sales: RecentSale[]
  emptyMessage?: string
}

function formatSoldDate(iso: string): string {
  if (!iso) return "Recent"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Recent"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function RecentSalesList({ title, sales, emptyMessage }: RecentSalesListProps) {
  if (sales.length === 0) {
    return (
      <div>
        <h5 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h5>
        <p className="text-xs text-muted-foreground">
          {emptyMessage ?? "No recent sold comps available."}
        </p>
      </div>
    )
  }

  return (
    <div>
      <h5 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h5>
      <ul className="flex flex-col gap-1.5">
        {sales.map((sale, index) => {
          const row = (
            <div
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border border-border bg-card/60 px-3 py-2",
                sale.url && "transition-colors hover:border-primary/30",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{sale.title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{formatSoldDate(sale.soldDate)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {"$"}
                  {sale.total.toFixed(2)}
                </p>
                {sale.shipping > 0 && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    +${sale.shipping.toFixed(2)} ship
                  </p>
                )}
              </div>
              {sale.url && (
                <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              )}
            </div>
          )

          return (
            <li key={`${sale.title}-${sale.soldDate}-${index}`}>
              {sale.url ? (
                <a href={sale.url} target="_blank" rel="noopener noreferrer" className="block">
                  {row}
                </a>
              ) : (
                row
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
