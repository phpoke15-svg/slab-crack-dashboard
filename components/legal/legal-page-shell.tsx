import Link from "next/link"
import type { ReactNode } from "react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteFooter } from "@/components/legal/site-footer"
import { LEGAL_LAST_UPDATED, LEGAL_SITE_NAME } from "@/lib/legal/config"

type LegalPageShellProps = {
  title: string
  description: string
  children: ReactNode
}

export function LegalPageShell({ title, description, children }: LegalPageShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-start justify-between gap-4 border-b border-border pb-6">
        <div className="min-w-0">
          <CollecToolsBrand href="/" size="sm" subtitle={`${LEGAL_SITE_NAME} legal`} />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground text-balance">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <p className="mt-1 text-xs text-muted-foreground">Last updated: {LEGAL_LAST_UPDATED}</p>
        </div>
        <Link
          href="/"
          className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Home
        </Link>
      </header>

      <article className="prose-legal flex-1">{children}</article>

      <SiteFooter className="mt-12 border-t border-border pt-8" />
    </div>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  )
}
