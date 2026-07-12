import Link from "next/link"
import { SiteFooter } from "@/components/legal/site-footer"

type ToolSeoIntroProps = {
  title: string
  description: string
  bullets?: string[]
  related?: Array<{ href: string; label: string }>
}

/**
 * Server-rendered intro so crawlers see an h1 and product copy even when
 * the interactive tool hydrates client-side.
 */
export function ToolSeoIntro({ title, description, bullets, related }: ToolSeoIntroProps) {
  return (
    <section className="border-b border-border bg-card/40 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        {bullets && bullets.length > 0 ? (
          <ul className="mt-3 max-w-3xl list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {related && related.length > 0 ? (
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Also on CollecTools:</span>
            {related.map((link) => (
              <Link key={link.href} href={link.href} className="text-primary hover:underline">
                {link.label}
              </Link>
            ))}
          </p>
        ) : null}
      </div>
    </section>
  )
}

export function ToolSeoFooter() {
  return <SiteFooter className="mx-auto max-w-5xl px-4 py-10 sm:px-6" />
}
