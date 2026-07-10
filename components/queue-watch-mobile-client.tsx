"use client"

import Link from "next/link"
import { ExternalLink, Smartphone } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"

export function QueueWatchMobileClient() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8">
        <CollecToolsBrand href="/" size="lg" subtitle="Queue Watch · Mobile APK" />
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Queue Watch is built into the CollecTools mobile app. Install the Android APK (or iOS build) for native
          monitoring and push alerts — no Pokemon Center tab or bookmarklet required.
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
                On your computer, open <code className="rounded bg-secondary px-1 text-xs">apps/pc-queue-watch</code>
              </li>
              <li>
                Run <code className="rounded bg-secondary px-1 text-xs">npm install</code>, then{" "}
                <code className="rounded bg-secondary px-1 text-xs">npx eas-cli login</code> and{" "}
                <code className="rounded bg-secondary px-1 text-xs">npx eas-cli init</code>
              </li>
              <li>
                Build: <code className="rounded bg-secondary px-1 text-xs">npm run build:apk</code>
              </li>
              <li>Download the .apk from the EAS build page and install it on your Android phone</li>
              <li>
                Open <strong className="text-foreground">CollecTools → Queue</strong>, allow notifications, tap{" "}
                <strong className="text-foreground">Start monitoring</strong>
              </li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Full steps: <code className="rounded bg-secondary px-1">apps/pc-queue-watch/README.md</code>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/60 p-5 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">What you get</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Native Queue Watch</strong> — polls from your phone every 20 seconds
            (backs off to 60s if Imperva challenges you)
          </li>
          <li>
            <strong className="text-foreground">Built-in push</strong> — no ntfy app required
          </li>
          <li>
            <strong className="text-foreground">Tools tab</strong> — SlabCrack, Grade Check, and PokeMatch inside the
            app
          </li>
        </ul>
        <Link
          href="/queue-watch"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Desktop Queue Watch <ExternalLink className="size-3.5" />
        </Link>
      </section>

      <footer className="mt-auto pt-10 text-center text-[11px] text-muted-foreground">
        <Link href="/queue-watch" className="hover:text-foreground">
          Desktop Queue Watch
        </Link>
      </footer>
    </div>
  )
}
