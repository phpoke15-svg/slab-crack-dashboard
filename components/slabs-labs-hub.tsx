"use client"

import Link from "next/link"
import { ArrowRight, FlaskConical } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { SLABLABS_SUBTOOLS } from "@/lib/slabs-labs-tools"
import { cn } from "@/lib/utils"

export function SlabLabsHub() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.14_155_/_0.14),transparent_55%)]"
      />
      <div className="relative mx-auto flex w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CollecToolsBrand href="/" size="lg" subtitle="SlabLabs · graded slab toolkit" />
            <h1 className="mt-5 flex items-center gap-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              <FlaskConical className="size-7 shrink-0 text-primary" aria-hidden />
              SlabLabs
            </h1>
          </div>
          <SiteAuthButton />
        </header>

        <div className="grid gap-3 sm:grid-cols-1">
          {SLABLABS_SUBTOOLS.map((tool) => {
            const Icon = tool.icon
            return (
              <Link
                key={tool.id}
                href={tool.href}
                className={cn(
                  "group flex items-start gap-4 rounded-2xl border border-border bg-card/70 p-4 transition-colors",
                  "hover:border-primary/40 hover:bg-card",
                )}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="size-5" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-foreground">{tool.name}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </span>
                  <span className="mt-0.5 block text-xs font-medium uppercase tracking-wide text-primary/80">
                    {tool.tagline}
                  </span>
                  <span className="mt-1.5 block text-sm leading-snug text-muted-foreground">
                    {tool.blurb}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>

        <SiteFooter className="mt-12" />
      </div>
    </main>
  )
}
