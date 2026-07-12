import Link from "next/link"
import { cn } from "@/lib/utils"

type CollecToolsBrandProps = {
  href?: string
  subtitle?: string
  size?: "sm" | "md" | "lg"
  className?: string
  /** Render the brand name as an h1 (homepage only). */
  asHeading?: boolean
}

export function CollecToolsBrand({
  href = "/",
  subtitle,
  size = "md",
  className,
  asHeading = false,
}: CollecToolsBrandProps) {
  const titleClass =
    size === "lg"
      ? "text-2xl"
      : size === "sm"
        ? "text-base"
        : "text-lg"

  const markClass =
    size === "lg"
      ? "size-11 text-xl"
      : size === "sm"
        ? "size-8 text-sm"
        : "size-9 text-base"

  const TitleTag = asHeading ? "h1" : "p"

  const content = (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-xl bg-background font-bold tracking-tight ring-1 ring-border",
          markClass,
        )}
      >
        <span className="text-foreground">C</span>
        <span className="text-primary">T</span>
      </span>
      <div className="leading-tight">
        <TitleTag className={cn("font-bold tracking-tight text-foreground", titleClass)}>
          Collec<span className="text-primary">Tools</span>
        </TitleTag>
        {subtitle ? (
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  )

  if (!href) return content

  return (
    <Link href={href} className="transition-opacity hover:opacity-90">
      {content}
    </Link>
  )
}

