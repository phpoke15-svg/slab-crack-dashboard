"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, FlaskConical, Loader2, RefreshCw, ShieldAlert } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useEntitlements } from "@/components/billing/entitlements-provider"
import { SUPREME_TOOLS } from "@/lib/collectools-tools"
import { cn } from "@/lib/utils"

type MetricsPayload = {
  ok: boolean
  service: string
  siteUrl: string
  commit: string | null
  env: string | null
  time: string
  you: { userId: string; email?: string | null; plan: string }
  checks: Record<string, boolean | string | null>
  counts: Record<string, number | null>
  planBreakdown: Record<string, number>
  error?: string
}

export function SupremeConsoleClient() {
  const { user, isLoading: authLoading, openAuthModal } = useAuth()
  const entitlements = useEntitlements()
  const [data, setData] = useState<MetricsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/supreme/metrics", { credentials: "same-origin" })
      const json = (await res.json().catch(() => null)) as MetricsPayload | null
      if (!res.ok || !json) {
        setData(null)
        setError(json && "error" in json ? String(json.error) : "Could not load metrics")
        return
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load metrics")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || entitlements.isLoading) return
    if (!user) return
    if (!entitlements.supreme) return
    void load()
  }, [authLoading, entitlements.isLoading, entitlements.supreme, user, load])

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.14_155_/_0.14),transparent_55%)]"
      />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CollecToolsBrand href="/" size="lg" subtitle="Supreme · owner console" />
            <h1 className="mt-5 flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              <FlaskConical className="size-7 text-primary" aria-hidden="true" />
              Supreme Console
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              In-development tools and live site metrics. Not sold publicly — allowlisted accounts
              only.
            </p>
          </div>
          <SiteAuthButton className="shrink-0" />
        </header>

        {authLoading || entitlements.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking access…
          </p>
        ) : !user ? (
          <div className="rounded-2xl border border-border bg-card/60 p-6">
            <p className="text-sm text-muted-foreground">Sign in with your owner account.</p>
            <button
              type="button"
              onClick={openAuthModal}
              className="mt-4 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Sign in
            </button>
          </div>
        ) : !entitlements.supreme ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <ShieldAlert className="size-4" /> Supreme access required
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This console is limited to allowlisted owner emails. Your plan:{" "}
              <span className="font-medium text-foreground">{entitlements.plan}</span>
            </p>
            <Link href="/" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
              Back to tools
            </Link>
          </div>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                In development
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {SUPREME_TOOLS.filter((t) => t.id !== "supreme").map((tool) => {
                  const Icon = tool.icon
                  return (
                    <Link
                      key={tool.id}
                      href={tool.href}
                      className="group rounded-2xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:border-primary/50 hover:bg-primary/10"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 items-center justify-center rounded-xl border border-primary/30 bg-background text-primary">
                          <Icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{tool.name}</h3>
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                              Dev
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Site metrics
                </h2>
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                  Refresh
                </button>
              </div>

              {error && (
                <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              {loading && !data ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading metrics…
                </p>
              ) : data ? (
                <div className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard label="Commit" value={data.commit ?? "—"} mono />
                    <MetricCard label="Env" value={data.env ?? "—"} mono />
                    <MetricCard label="Site" value={data.siteUrl} />
                    <MetricCard label="Your plan" value={data.you.plan} />
                  </div>

                  <div className="rounded-2xl border border-border bg-card/50 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Config checks
                    </h3>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {Object.entries(data.checks).map(([key, value]) => (
                        <li
                          key={key}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-xs"
                        >
                          <span className="font-mono text-muted-foreground">{key}</span>
                          <StatusPill value={value} />
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-border bg-card/50 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Table counts
                    </h3>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(data.counts).map(([key, value]) => (
                        <li
                          key={key}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-xs"
                        >
                          <span className="font-mono text-muted-foreground">{key}</span>
                          <span className="font-mono font-semibold tabular-nums text-foreground">
                            {value == null ? "—" : value.toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-border bg-card/50 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Profiles by plan
                    </h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(data.planBreakdown).length === 0 ? (
                        <li className="text-xs text-muted-foreground">No profile rows</li>
                      ) : (
                        Object.entries(data.planBreakdown).map(([plan, count]) => (
                          <li
                            key={plan}
                            className="rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs"
                          >
                            <span className="font-medium capitalize text-foreground">{plan}</span>
                            <span className="ml-2 font-mono tabular-nums text-muted-foreground">
                              {count}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Updated {new Date(data.time).toLocaleString()} · {data.you.email}
                  </p>
                </div>
              ) : null}
            </section>
          </>
        )}

        <SiteFooter className="mt-12" />
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-3 py-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-semibold text-foreground", mono && "font-mono")}>
        {value}
      </p>
    </div>
  )
}

function StatusPill({ value }: { value: boolean | string | null }) {
  if (typeof value === "boolean") {
    return (
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase",
          value ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive",
        )}
      >
        {value ? "yes" : "no"}
      </span>
    )
  }
  if (value == null) {
    return <span className="text-muted-foreground">—</span>
  }
  return <span className="font-mono text-foreground">{value}</span>
}
