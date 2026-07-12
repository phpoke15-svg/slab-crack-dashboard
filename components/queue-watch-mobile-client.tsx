"use client"

import Link from "next/link"
import { ExternalLink, Smartphone } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"

export function QueueWatchMobileClient() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8">
        <CollecToolsBrand href="/" size="lg" subtitle="PokeWatch · Mobile APK" />
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          PokeWatch is built into the CollecTools Android app. It opens Pokemon Center in-app so you can
          pass Imperva, then watches Queue-it from that real browser session — same idea as the desktop
          bookmarklet, with native push.
        </p>
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
                Open <strong className="text-foreground">CollecTools</strong>, sign in on the site
                tab, visit PokeWatch once (Pro) so the app can sync
              </li>
              <li>
                Open <strong className="text-foreground">Queue</strong>, allow notifications,{" "}
                <strong className="text-foreground">Start monitoring</strong>, pass any bot check,
                leave the tab open during drops
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
            <strong className="text-foreground">Imperva-safe WebView monitor</strong> — detect Queue-it after
            you pass the bot check in-app
          </li>
          <li>
            <strong className="text-foreground">Built-in push</strong> — local notification when the queue
            flips live
          </li>
          <li>
            <strong className="text-foreground">CollecTools tab</strong> — SlabCrack and PokeMatch
            inside the app
          </li>
        </ul>
        <p className="mt-3 text-xs">
          Requires CollecTools Pro for the web PokeWatch page; the native APK monitor runs on-device.
          Keep the Queue tab open for best results — background headless checks are a weak fallback.
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
