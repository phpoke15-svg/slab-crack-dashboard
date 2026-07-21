/** Upstream Scrydex HTTP failure (vision, catalog, etc.). */
export class ScrydexApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ScrydexApiError"
    this.status = status
  }
}

export class InvalidVisionImageError extends Error {
  constructor(message = "Invalid scan image") {
    super(message)
    this.name = "InvalidVisionImageError"
  }
}

export function mapScrydexApiErrorStatus(status: number): number {
  if (status === 429) return 429
  if (status >= 500) return 502
  if (status === 404 || status === 422) return 422
  if (status >= 400) return 400
  return 502
}

type PostgrestLikeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

/** Stringify Supabase PostgREST errors and other non-Error throw values. */
export function formatUnknownError(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error && error.message) return error.message

  if (error && typeof error === "object") {
    const pg = error as PostgrestLikeError
    const parts = [pg.message, pg.code ? `code=${pg.code}` : null, pg.details, pg.hint].filter(Boolean)
    if (parts.length > 0) return parts.join(" — ")
  }

  if (typeof error === "string" && error.trim()) return error.trim()
  return fallback
}
