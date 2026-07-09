/** Shared legal / site identity — override via env where noted. */
export const LEGAL_SITE_NAME = "CollecTools"
export const LEGAL_PRODUCT_NAME = "PokeMatch"
export const LEGAL_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://slab-crack-dashboard.vercel.app"
export const LEGAL_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@collectools.app"
export const LEGAL_LAST_UPDATED = "July 9, 2026"
