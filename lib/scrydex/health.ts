import { isScrydexConfigured, scrydexDailyCreditBudget } from "@/lib/scrydex/constants"
import { getCreditsUsedToday } from "@/lib/scrydex/credit-ledger"

export type ScrydexHealthCheck = {
  configured: boolean
  apiReachable: boolean | null
  creditsUsedToday: number | null
  dailyBudget: number
  error: string | null
}

/** Lightweight Scrydex probe for /api/health — does not spend API credits. */
export async function checkScrydexHealth(opts?: { probeApi?: boolean }): Promise<ScrydexHealthCheck> {
  const configured = isScrydexConfigured()
  const dailyBudget = scrydexDailyCreditBudget()

  if (!configured) {
    return {
      configured: false,
      apiReachable: null,
      creditsUsedToday: null,
      dailyBudget,
      error: "SCRYDEX_API_KEY or SCRYDEX_TEAM_ID missing",
    }
  }

  let creditsUsedToday: number | null = null
  try {
    creditsUsedToday = await getCreditsUsedToday()
  } catch {
    creditsUsedToday = null
  }

  if (!opts?.probeApi) {
    return {
      configured: true,
      apiReachable: null,
      creditsUsedToday,
      dailyBudget,
      error: null,
    }
  }

  try {
    const response = await fetch("https://api.scrydex.com/pokemon/v1/expansions?page=1&page_size=1&casing=snake", {
      headers: {
        Accept: "application/json",
        "X-Api-Key": process.env.SCRYDEX_API_KEY!.trim(),
        "X-Team-ID": process.env.SCRYDEX_TEAM_ID!.trim(),
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      return {
        configured: true,
        apiReachable: false,
        creditsUsedToday,
        dailyBudget,
        error: `Scrydex HTTP ${response.status}: ${body.slice(0, 120) || response.statusText}`,
      }
    }

    return {
      configured: true,
      apiReachable: true,
      creditsUsedToday,
      dailyBudget,
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      apiReachable: false,
      creditsUsedToday,
      dailyBudget,
      error: error instanceof Error ? error.message : "Scrydex probe failed",
    }
  }
}
