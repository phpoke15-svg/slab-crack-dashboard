import "server-only"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"

export type ScannerMatchFeedbackInput = {
  userId?: string | null
  correct: boolean
  scanMode: "single" | "multi"
  presentedCardId?: string | null
  cardName?: string | null
  setName?: string | null
  cardNumber?: string | null
  matchMethod?: "visual_phash" | "vision" | null
  matchScore?: number | null
  batchIndex?: number | null
}

function missingTableMessage(error: { message?: string } | null): string | null {
  const message = error?.message ?? ""
  if (/relation .* does not exist|could not find the table/i.test(message)) {
    return "Scanner feedback table is not set up yet. Run supabase/scanner-feedback.sql in Supabase."
  }
  return null
}

export async function submitScannerMatchFeedback(
  input: ScannerMatchFeedbackInput,
): Promise<{ id: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured")
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("scanner_match_feedback")
    .insert({
      user_id: input.userId ?? null,
      correct: input.correct,
      scan_mode: input.scanMode,
      presented_card_id: input.presentedCardId?.trim() || null,
      card_name: input.cardName?.trim() || null,
      set_name: input.setName?.trim() || null,
      card_number: input.cardNumber?.trim() || null,
      match_method: input.matchMethod ?? null,
      match_score:
        input.matchScore != null && Number.isFinite(input.matchScore)
          ? Math.round(input.matchScore)
          : null,
      batch_index:
        input.batchIndex != null && Number.isFinite(input.batchIndex)
          ? Math.max(0, Math.min(8, Math.round(input.batchIndex)))
          : null,
    })
    .select("id")
    .single()

  const missing = missingTableMessage(error)
  if (missing) throw new Error(missing)
  if (error) throw new Error(error.message)
  return { id: data.id as string }
}
