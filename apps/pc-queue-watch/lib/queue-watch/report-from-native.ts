import { COLLECTOOLS_BASE_URL } from "../config"

export type NativeScanPayload = {
  live: boolean
  confidence: number
  signals: Array<{ id: string; label: string; confidence: number }>
  pageUrl?: string
  challenge?: boolean
}

export async function reportNativeScan(input: {
  sessionId: string
  token: string
  scan: NativeScanPayload
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const { sessionId, token, scan } = input
  if (!sessionId || !token) {
    return { ok: false, status: 401, error: "Missing PokeWatch credentials" }
  }

  try {
    const res = await fetch(`${COLLECTOOLS_BASE_URL}/api/pokemon-center/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Queue-Watch-Token": token,
      },
      body: JSON.stringify({
        sessionId,
        live: scan.live,
        confidence: scan.confidence,
        signals: scan.signals,
        pageUrl: scan.pageUrl?.slice(0, 500),
        source: "mobile",
      }),
    })

    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      return {
        ok: false,
        status: res.status,
        error: json?.error || `Report failed (${res.status})`,
      }
    }

    return { ok: true, status: res.status }
  } catch {
    return { ok: false, status: 0, error: "Offline — will retry on next scan" }
  }
}
