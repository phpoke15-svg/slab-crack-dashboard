import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { cn } from "@/lib/utils"

export function TabShellHeader({
  title,
  subtitle,
  className,
}: {
  title: string
  subtitle?: string
  className?: string
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <CollecToolsBrand href="/" size="md" subtitle={subtitle ?? title} />
        <h1 className="sr-only">{title}</h1>
      </div>
      <SiteAuthButton className="shrink-0" />
    </header>
  )
}
