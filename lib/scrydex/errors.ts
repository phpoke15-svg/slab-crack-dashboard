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
