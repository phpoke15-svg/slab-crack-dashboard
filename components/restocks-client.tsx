"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ExternalLink, Loader2, Package, RefreshCw } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { cn } from "@/lib/utils"
import type { RestockProduct, RestockRetailer } from "@/lib/restocks/types"

type Meta = {
  walmartConfigured: boolean
  count: number
  checkedAt: string
}

function formatAgo(iso: string | null) {
  if (!iso) return "never"
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function retailerLabel(retailer: RestockRetailer) {
  return retailer === "walmart" ? "Walmart" : "Pokémon Center"
}

export function RestocksClient() {
  const [products, setProducts] = useState<RestockProduct[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retailer, setRetailer] = useState<"all" | RestockRetailer>("walmart")
  const [inStockOnly, setInStockOnly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (retailer !== "all") params.set("retailer", retailer)
      if (inStockOnly) params.set("inStock", "1")
      const res = await fetch(`/api/restocks?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Could not load restocks")
      const data = (await res.json()) as { products: RestockProduct[]; meta: Meta }
      setProducts(data.products ?? [])
      setMeta(data.meta ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [retailer, inStockOnly])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 60_000)
    return () => window.clearInterval(id)
  }, [load])

  const sorted = useMemo(() => {
    return [...products].sort((a, b) => {
      const aScore = a.inStock === true ? 0 : a.inStock === false ? 1 : 2
      const bScore = b.inStock === true ? 0 : b.inStock === false ? 1 : 2
      if (aScore !== bScore) return aScore - bScore
      return (b.lastRestockAt ?? b.updatedAt).localeCompare(a.lastRestockAt ?? a.updatedAt)
    })
  }, [products])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <CollecToolsBrand href="/" size="lg" subtitle="Restocks · Walmart sealed TCG" />
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Automatically finds Pokémon sealed products at Walmart and tracks stock. For Pokémon
            Center drop timing and virtual queues, use{" "}
            <Link href="/queue-watch" className="font-medium text-primary hover:underline">
              Queue Watch
            </Link>
            .
          </p>
        </div>
        <SiteAuthButton className="shrink-0" />
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "walmart", "pokemon_center"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRetailer(key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              retailer === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {key === "all" ? "All" : retailerLabel(key)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setInStockOnly((v) => !v)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            inStockOnly
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border text-muted-foreground",
          )}
        >
          In stock only
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {meta && (
        <p className="mb-4 text-xs text-muted-foreground">
          {meta.count} watched · Walmart API{" "}
          {meta.walmartConfigured ? "configured" : "not configured yet"} · board refreshed{" "}
          {formatAgo(meta.checkedAt)}
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && products.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading restocks…
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No active products yet</p>
          <p className="mt-2">
            Run <code className="rounded bg-secondary px-1 text-xs">supabase/restocks.sql</code>, then
            insert real Walmart item IDs and Pokémon Center product URLs with{" "}
            <code className="rounded bg-secondary px-1 text-xs">active = true</code>.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((product) => (
            <li
              key={product.id}
              className={cn(
                "rounded-2xl border p-4",
                product.inStock === true
                  ? "border-trade/40 bg-trade/5"
                  : "border-border bg-card/60",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/50 text-muted-foreground">
                  <Package className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {retailerLabel(product.retailer)}
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        product.inStock === true
                          ? "bg-trade/20 text-trade"
                          : product.inStock === false
                            ? "bg-secondary text-muted-foreground"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {product.inStock === true
                        ? "In stock"
                        : product.inStock === false
                          ? "Out of stock"
                          : "Unknown"}
                    </span>
                    {product.queueLikely ? (
                      <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Queue likely
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-foreground">{product.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Checked {formatAgo(product.lastCheckedAt)}
                    {product.lastRestockAt ? ` · last restock ${formatAgo(product.lastRestockAt)}` : ""}
                    {product.price != null ? ` · $${product.price.toFixed(2)}` : ""}
                    {product.lastSource ? ` · via ${product.lastSource}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={product.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                    >
                      Open product <ExternalLink className="size-3.5" />
                    </a>
                    {product.retailer === "walmart" ? null : product.queueLikely ? (
                      <Link
                        href="/queue-watch"
                        className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground hover:border-primary/40"
                      >
                        Queue Watch
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-8 rounded-2xl border border-border bg-card/40 p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">How this stays hands-off</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <strong className="text-foreground">Discovery</strong> — cron searches Walmart for sealed
            Pokémon TCG (ETBs, bundles, boxes, etc.) and adds matches automatically.
          </li>
          <li>
            <strong className="text-foreground">Stock checks</strong> — same cron polls Affiliate
            availability every 15 minutes and can Discord-ping on restock.
          </li>
          <li>
            <strong className="text-foreground">Pokémon Center</strong> — use{" "}
            <Link href="/queue-watch" className="text-primary hover:underline">
              Queue Watch
            </Link>{" "}
            for queue-live alerts (not this board).
          </li>
        </ul>
      </section>

      <SiteFooter className="mt-auto pt-10" />
    </div>
  )
}
