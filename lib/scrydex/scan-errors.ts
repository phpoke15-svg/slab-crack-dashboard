import { ScrydexCreditBudgetError } from "@/lib/scrydex/credit-ledger"
import { InvalidVisionImageError, ScrydexApiError, mapScrydexApiErrorStatus } from "@/lib/scrydex/errors"
import { ScrydexVisionNoMatchError } from "@/lib/scrydex/vision-pipeline"

export function mapVisionScanErrorStatus(error: unknown): number {
  if (error instanceof InvalidVisionImageError) return 400
  if (error instanceof ScrydexCreditBudgetError) return 429
  if (error instanceof ScrydexVisionNoMatchError) return 422
  if (error instanceof ScrydexApiError) return mapScrydexApiErrorStatus(error.status)

  const message = error instanceof Error ? error.message : ""
  if (/returned no match|could not be loaded|could not identify/i.test(message)) return 422
  if (/not configured/i.test(message)) return 503
  if (/Scrydex 429/i.test(message)) return 429
  if (/Scrydex 5\d\d/i.test(message)) return 502
  if (/Scrydex 4\d\d/i.test(message)) return 422

  return 500
}
