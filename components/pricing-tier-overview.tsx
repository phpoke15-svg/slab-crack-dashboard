import { Check } from "lucide-react"
import { displayPlanFeatures, PLAN_TIERS, STARTER_PLAN } from "@/lib/billing/plans"

const TIERS = [
  { ...STARTER_PLAN, priceLabel: "Free" },
  ...PLAN_TIERS.map((tier) => ({
    id: tier.id,
    name: tier.name,
    tagline: tier.tagline,
    features: tier.features,
    priceLabel: `$${tier.monthlyPrice.toFixed(2)}/mo`,
  })),
]

export function PricingTierOverview() {
  return (
    <section className="border-b border-border bg-card/20 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-lg font-semibold text-foreground">Account tiers &amp; monthly giveaway</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Every account tier earns free monthly giveaway entries. The cash prize is paid via PayPal only.
          Premium and Pro lower the active minutes you need each day to earn your entry.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {TIERS.map((tier) => (
            <article
              key={tier.id}
              className="rounded-2xl border border-border/80 bg-card/50 p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{tier.name}</h3>
                <p className="text-xs font-medium text-primary">{tier.priceLabel}</p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tier.tagline}</p>
              <ul className="mt-3 space-y-1.5">
                {displayPlanFeatures(tier.features).map((feature) => (
                  <li key={feature} className="flex gap-2 text-xs text-foreground">
                    <Check
                      className="mt-0.5 size-3.5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
