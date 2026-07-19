import Link from "next/link"
import { ArrowLeft, BarChart3, Construction } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { SLABCRACK_HREF, SLABLABS_HREF } from "@/lib/slabs-labs-routes"
import { cn } from "@/lib/utils"

export function SlabPopComingSoon() {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center sm:p-10">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
        <BarChart3 className="size-7" aria-hidden />
      </div>
      <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Construction className="size-3.5" aria-hidden />
        Coming soon
      </div>
      <h2 className="mt-4 text-xl font-bold text-foreground sm:text-2xl">SlabPop is on the way</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        We&apos;re building population-report filters with non-linear pop sliders, price bands, and
        grade targeting. Check back soon — or use SlabCrack and SlabIt in SlabLabs today.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Link href={SLABCRACK_HREF} className={cn(buttonVariants({ size: "lg" }))}>
          Open SlabCrack
        </Link>
        <Link href={SLABLABS_HREF} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to SlabLabs
        </Link>
      </div>
    </section>
  )
}
