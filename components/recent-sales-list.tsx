"use client"

import { useState } from "react"
import { ChevronDown, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RecentSale } from "@/lib/slab-data"

interface RecentSalesListProps {
  title: string
  sales: RecentSale[]
  emptyMessage?: string
  /** Start collapsed (default true). */
  defaultOpen?: boolean
}

function formatSoldDate(iso: string): string {
  if (!iso) return "Recent"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Recent"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

/** Prefer the newest sold date when older caches still hold multiple comps. */
export function pickMostRecentSale(sales: RecentSale[]): RecentSale | null {
  if (sales.length === 0) return null
  if (sales.length === 1) return sales[0]
  return [...sales].sort((a, b) => {
    const aTs = Date.parse(a.soldDate || "") || 0
    const bTs = Date.parse(b.soldDate || "") || 0
    return bTs - aTs
  })[0]
}

export function RecentSalesList({
  title,
  sales,
  emptyMessage,
  defaultOpen = false,
}: RecentSalesListProps) {
  const [open, setOpen] = useState(defaultOpen)
  const sale = pickMostRecentSale(sales)

  return (
    <div className="rounded-xl border border-border bg-card/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          {sale ? (
            <p className="mt-0.5 truncate text-xs text-foreground">
              <span className="font-mono font-semibold tabular-nums">${sale.total.toFixed(2)}</span>
              <span className="text-muted-foreground"> · {formatSoldDate(sale.soldDate)}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">No comps</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border px-3 py-2.5">
          {!sale ? (
            <p className="text-xs text-muted-foreground">
              {emptyMessage ?? "No recent sold comps available."}
            </p>
          ) : (
            <SaleRow sale={sale} />
          )}
        </div>
      )}
    </div>
  )
}

function SaleRow({ sale }: { sale: RecentSale }) {
  const row = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{sale.title}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{formatSoldDate(sale.soldDate)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
          ${sale.total.toFixed(2)}
        </p>
        {sale.shipping > 0 && (
          <p className="font-mono text-[10px] text-muted-foreground">
            +${sale.shipping.toFixed(2)} ship
          </p>
        )}
      </div>
      {sale.url && <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
    </div>
  )

  if (sale.url) {
    return (
      <a href={sale.url} target="_blank" rel="noopener noreferrer" className="block">
        {row}
      </a>
    )
  }
  return row
}
