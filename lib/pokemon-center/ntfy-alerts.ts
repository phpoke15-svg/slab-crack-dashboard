const lastNtfyAt = new Map<string, number>()
const NTFY_COOLDOWN_MS = 5 * 60 * 1000

export async function maybeSendNtfyAlert(input: {
  topic: string
  live: boolean
  signals?: Array<{ label: string }>
  pageUrl?: string
}): Promise<boolean> {
  if (!input.live) return false

  const topic = input.topic.trim().replace(/^\/+/, "")
  if (!topic || topic.length > 120 || !/^[a-zA-Z0-9_-]+$/.test(topic)) return false

  const key = `${topic}:live`
  const last = lastNtfyAt.get(key) ?? 0
  if (Date.now() - last < NTFY_COOLDOWN_MS) return false

  const signalSummary =
    input.signals && input.signals.length > 0
      ? input.signals.map((s) => s.label).join(", ")
      : "Queue activity detected"

  const response = await fetch(`https://ntfy.sh/${topic}`, {
    method: "POST",
    headers: {
      Title: "Pokemon Center queue LIVE",
      Tags: "rotating_light,bell",
      Priority: "5",
    },
    body: [
      "Pokemon Center virtual queue is live.",
      signalSummary,
      input.pageUrl ?? "https://www.pokemoncenter.com/",
    ].join("\n"),
  })

  if (!response.ok) return false
  lastNtfyAt.set(key, Date.now())
  return true
}

export function ntfySubscribeUrl(topic: string) {
  return `https://ntfy.sh/${topic}`
}

export function ntfyAppDeepLink(topic: string) {
  return `ntfy://ntfy.sh/${topic}`
}
