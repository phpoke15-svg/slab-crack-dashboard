import { LEGAL_CONTACT_EMAIL, LEGAL_SITE_NAME, LEGAL_SITE_URL } from "@/lib/legal/config"
import type { ReportReason } from "@/lib/trade-binder/blocks"

type ReportAlertInput = {
  reporterId: string
  reportedId: string
  reason: ReportReason
  details: string
}

/**
 * Best-effort ops alert when a user is reported.
 * Prefers Discord webhook; falls back to logging the support inbox address.
 */
export async function notifyUserReport(input: ReportAlertInput): Promise<void> {
  const webhook =
    process.env.REPORTS_DISCORD_WEBHOOK?.trim() ||
    process.env.POKEMON_CENTER_DISCORD_WEBHOOK?.trim()

  const summary = [
    `**${LEGAL_SITE_NAME} user report**`,
    `Reason: \`${input.reason}\``,
    `Reporter: \`${input.reporterId}\``,
    `Reported: \`${input.reportedId}\``,
    input.details.trim() ? `Details: ${input.details.trim().slice(0, 500)}` : null,
    `Review in Supabase → \`user_reports\``,
    `Contact: ${LEGAL_CONTACT_EMAIL}`,
    LEGAL_SITE_URL,
  ]
    .filter(Boolean)
    .join("\n")

  if (!webhook) {
    console.warn("[reports]", summary.replace(/\*\*|`/g, ""))
    return
  }

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: summary.slice(0, 1900),
      }),
    })
  } catch (err) {
    console.error("[reports] webhook failed", err)
  }
}
