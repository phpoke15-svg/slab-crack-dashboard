/** Canonical browser/email origins for auth redirects (password reset, confirm). */

const PRODUCTION_ORIGIN = "https://www.collectools.app"

/**
 * Normalize local / apex / preview hosts so Supabase allowlists stay consistent.
 * Apex collectools.app 308s to www — prefer www for email links.
 */
export function normalizeAuthOrigin(rawOrigin: string | null | undefined): string {
  const fallback = PRODUCTION_ORIGIN
  if (!rawOrigin?.trim()) return fallback
  try {
    const url = new URL(rawOrigin.trim())
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback
    if (url.hostname === "collectools.app") {
      url.hostname = "www.collectools.app"
    }
    return url.origin
  } catch {
    return fallback
  }
}

/** Redirect target for password-reset emails. */
export function passwordResetRedirectTo(origin?: string | null): string {
  return `${normalizeAuthOrigin(origin)}/reset-password`
}

/** Redirect target after signup email confirmation. */
export function emailConfirmRedirectTo(origin?: string | null): string {
  return `${normalizeAuthOrigin(origin)}/sign-in`
}
