/** Shared legal / site identity — override via env where noted. */
import { getSiteUrl } from "@/lib/site-url"

export const LEGAL_SITE_NAME = "CollecTools"
export const LEGAL_PRODUCT_NAME = "PokeMatch"
export const LEGAL_SITE_URL = getSiteUrl()
export const LEGAL_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "support@collectools.app"
export const LEGAL_LAST_UPDATED = "July 11, 2026"
