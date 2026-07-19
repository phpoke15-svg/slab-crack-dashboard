import Link from "next/link"
import { COLLECTOOLS } from "@/lib/collectools-tools"
import { SEO_DEFAULT_DESCRIPTION } from "@/lib/seo"

/**
 * Server-rendered hub copy so Google sees stable headings and internal links
 * without waiting for the interactive hub to hydrate.
 */
export function HomeSeoIntro() {
  return (
    <section
      aria-label="CollecTools overview"
      className="seo-crawl-intro"
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Pokémon TCG collector tools
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{SEO_DEFAULT_DESCRIPTION}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Tools: </span>
          {COLLECTOOLS.map((tool, index) => (
            <span key={tool.id}>
              {index > 0 ? " · " : null}
              <Link href={tool.href} className="text-primary hover:underline">
                {tool.name}
              </Link>
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}
