import Link from "next/link"
import { Layers } from "lucide-react"
import { cn } from "@/lib/utils"

type CollecToolsBrandProps = {
  href?: string
  subtitle?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function CollecToolsBrand({
  href = "/",
  subtitle,
  size = "md",
  className,
}: CollecToolsBrandProps) {
  const titleClass =
    size === "lg"
      ? "text-2xl"
      : size === "sm"
        ? "text-base"
        : "text-lg"

  const iconSize = size === "lg" ? "size-11" : size === "sm" ? "size-8" : "size-9"
  const glyphSize = size === "lg" ? "size-6" : size === "sm" ? "size-4" : "size-5"

  const content = (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_-4px] shadow-primary/60",
          iconSize,
        )}
      >
        <Layers className={glyphSize} strokeWidth={2.5} />
      </span>
      <div className="leading-tight">
        <p className={cn("font-bold tracking-tight text-foreground", titleClass)}>
          Collec<span className="text-primary">Tools</span>
        </p>
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
