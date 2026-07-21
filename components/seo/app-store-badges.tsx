import { iosAppStoreUrl, playStoreUrl } from "@/lib/app-stores"
import { cn } from "@/lib/utils"

type AppStoreBadgesProps = {
  className?: string
  /** Tighter layout for footers. */
  compact?: boolean
}

export function AppStoreBadges({ className, compact = false }: AppStoreBadgesProps) {
  return (
    <div
      className={cn(
        "mobile-store-badges flex flex-wrap items-center gap-2",
        compact ? "justify-center" : "justify-start",
        className,
      )}
    >
      <a
        href={iosAppStoreUrl()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download CollecTools on the App Store"
        className="inline-flex h-10 items-center rounded-lg border border-border bg-card/80 px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-card"
      >
        App Store
      </a>
      <a
        href={playStoreUrl()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get CollecTools on Google Play"
        className="app-store-badge--android inline-flex h-10 items-center rounded-lg border border-border bg-card/80 px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-card"
      >
        Google Play
      </a>
    </div>
  )
}
