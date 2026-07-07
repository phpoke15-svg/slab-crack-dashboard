"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { COLLECTOOLS } from "@/lib/collectools-tools"
import { cn } from "@/lib/utils"

export function CollecToolsHub() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-10">
        <CollecToolsBrand href={undefined} size="lg" subtitle="Tools for TCG collectors" />
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Pick a tool to get started. SlabCrack finds arbitrage, Grade Check helps you pre-grade at
          home, and PokeMatch keeps your collection organized for swaps.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-1">
        {COLLECTOOLS.map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.id}
              href={tool.href}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-5 transition-all",
                "hover:border-primary/40 hover:bg-card hover:shadow-[0_0_40px_-12px] hover:shadow-primary/25",
              )}
            >
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="size-6" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{tool.name}</h2>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {tool.tagline}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {tool.description}
                  </p>
                </div>
                <ArrowRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          )
        })}
      </div>

      <footer className="mt-auto pt-12 text-center text-[11px] text-muted-foreground">
        Prices and estimates are for research only — not financial advice.
      </footer>
    </div>
  )
}
