"use client"

import Link from "next/link"
import { Bell, ExternalLink, Smartphone } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"

export function QueueWatchMobileClient() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8">
        <CollecToolsBrand href="/" size="lg" subtitle="PokeWatch · Mobile" />
      </header>

      <section className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Smartphone className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-foreground">PokeWatch on your phone</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Enable queue alerts on the main PokeWatch page. When the Pokemon Center virtual queue
              goes live, you&apos;ll get a push notification — no browser bookmark or tab monitor
              required.
            </p>
            <Link
              href="/pokewatch"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Bell className="size-4" />
              Enable alerts on PokeWatch
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/60 p-5 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">What you need</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">CollecTools Pro or Supreme</strong> — queue alerts
            are a Pro feature
          </li>
          <li>
            <strong className="text-foreground">Push enabled</strong> — turn on alerts at{" "}
            <Link href="/pokewatch" className="text-primary hover:underline">
              /pokewatch
            </Link>
          </li>
          <li>
            <strong className="text-foreground">iPhone tip</strong> — add CollecTools to your Home
            Screen first, then enable alerts from that icon
          </li>
        </ul>
        <Link
          href="/pokewatch"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Go to PokeWatch <ExternalLink className="size-3.5" />
        </Link>
      </section>

      <footer className="mt-auto pt-10 text-center text-[11px] text-muted-foreground">
        <Link href="/pokewatch" className="hover:text-foreground">
          PokeWatch
        </Link>
      </footer>
    </div>
  )
}
