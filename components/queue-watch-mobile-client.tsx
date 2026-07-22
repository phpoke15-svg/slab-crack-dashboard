"use client"

import Link from "next/link"
import { ExternalLink, Smartphone } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"

export function QueueWatchMobileClient() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8">
        <CollecToolsBrand href="/" size="lg" subtitle="PokeWatch · Mobile APK" />
      </header>

      <section className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Smartphone className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Install the CollecTools APK</h1>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                On your computer:{" "}
                <code className="rounded bg-secondary px-1 text-xs">cd apps/pc-queue-watch</code>
              </li>
              <li>
                <code className="rounded bg-secondary px-1 text-xs">npm install</code> then{" "}
                <code className="rounded bg-secondary px-1 text-xs">npx eas-cli login</code>
              </li>
              <li>
                Build: <code className="rounded bg-secondary px-1 text-xs">npm run build:apk</code>
              </li>
              <li>Install the APK from the EAS build page (allow unknown sources if asked)</li>
              <li>
                Open the app, sign in via <strong className="text-foreground">CollecTools</strong> (Pro),
                then tap <strong className="text-foreground">Copy Widget Code</strong>
              </li>
              <li>
                Follow the 3-step guide to paste the bookmarklet into your mobile browser. Enable phone
                alerts on <strong className="text-foreground">/pokewatch</strong>
              </li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Play / App Store steps:{" "}
              <code className="rounded bg-secondary px-1">apps/pc-queue-watch/STORE.md</code>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/60 p-5 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">What you get</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Install Queue Watcher</strong> — copy bookmarklet code,
            no Pokemon Center loaded in-app
          </li>
          <li>
            <strong className="text-foreground">Push alerts</strong> — server canary + web push when queue
            goes live
          </li>
          <li>
            <strong className="text-foreground">Live log</strong> — status dashboard in the app
          </li>
        </ul>
        <p className="mt-3 text-xs">
          Requires CollecTools Pro. On drop day, open your browser, go to pokemoncenter.com, and tap your
          PC Queue bookmark after you get the push.
        </p>
        <Link
          href="/pokewatch"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Desktop PokeWatch <ExternalLink className="size-3.5" />
        </Link>
      </section>

      <footer className="mt-auto pt-10 text-center text-[11px] text-muted-foreground">
        <Link href="/pokewatch" className="hover:text-foreground">
          Desktop PokeWatch
        </Link>
      </footer>
    </div>
  )
}
