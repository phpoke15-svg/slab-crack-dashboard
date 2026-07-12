import Link from "next/link"
import { cn } from "@/lib/utils"
import { LEGAL_CONTACT_EMAIL, LEGAL_SITE_NAME } from "@/lib/legal/config"
import { RESTOCKS_ENABLED } from "@/lib/collectools-tools"

type SiteFooterProps = {
  className?: string
}

const PRODUCT_LINKS = [
  { href: "/slabcrack", label: "SlabCrack" },
  { href: "/slablab", label: "SlabLab" },
  { href: "/binder", label: "PokeMatch" },
  { href: "/pokewatch", label: "PokeWatch" },
  ...(RESTOCKS_ENABLED ? [{ href: "/restocks", label: "Restocks" }] : []),
  { href: "/pricing", label: "Pricing" },
] as const

export function SiteFooter({ className }: SiteFooterProps) {
  return (
    <footer className={cn("text-center text-[11px] leading-relaxed text-muted-foreground", className)}>
      <nav aria-label="Tools" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {PRODUCT_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="transition-colors hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <nav
        aria-label="Legal"
        className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
      >
        <Link href="/privacy" className="transition-colors hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/terms" className="transition-colors hover:text-foreground">
          Terms of Service
        </Link>
        <a
          href={`mailto:${LEGAL_CONTACT_EMAIL}`}
          className="transition-colors hover:text-foreground"
        >
          Contact
        </a>
      </nav>
      <p className="mt-3 text-pretty">
        © {new Date().getFullYear()} {LEGAL_SITE_NAME}. Card prices and estimates are for research
        only — not financial advice. Pokémon TCG is a trademark of The Pokémon Company;{" "}
        {LEGAL_SITE_NAME} is not affiliated with or endorsed by them.
      </p>
    </footer>
  )
}
