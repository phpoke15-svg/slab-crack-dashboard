export type QueueSignal = {
  id: string
  label: string
  confidence: number
}

export type QueueDetection = {
  live: boolean
  confidence: number
  signals: QueueSignal[]
  blocked?: boolean
  finalUrl?: string
  checkedAt: string
}

const QUEUE_PATTERNS: Array<{ id: string; label: string; confidence: number; re: RegExp }> = [
  { id: "queue-it-net", label: "Queue-it network domain", confidence: 100, re: /queue-it\.net/i },
  { id: "queue-it-js", label: "Queue-it script", confidence: 90, re: /queue-it\.js|queueit/i },
  { id: "waiting-room-url", label: "Waiting room URL", confidence: 100, re: /waitingroom|waiting-room/i },
  { id: "virtual-queue", label: "Virtual queue copy", confidence: 70, re: /virtual queue|waiting room/i },
  { id: "hi-trainer", label: "Queue greeting", confidence: 60, re: /hi,?\s*trainer/i },
  { id: "queue-timer", label: "Queue countdown", confidence: 50, re: /\b\d{1,2}:\d{2}:\d{2}\b.*(?:queue|wait)/i },
  { id: "incapsula-queue", label: "Incapsula queue payload", confidence: 80, re: /"pos"\s*:\s*\d+.*"pending"\s*:\s*1/i },
]

const BLOCKED_PATTERNS: Array<{ id: string; label: string; re: RegExp }> = [
  { id: "incapsula-block", label: "Imperva/Incapsula challenge", re: /_Incapsula_Resource|incident_id=/i },
  { id: "access-denied", label: "Access denied", re: /access denied|request unsuccessful/i },
]

export function detectQueueFromContent(input: {
  html?: string
  url?: string
  blocked?: boolean
}): QueueDetection {
  const checkedAt = new Date().toISOString()
  const haystack = `${input.url ?? ""}\n${input.html ?? ""}`
  const signals: QueueSignal[] = []

  if (input.blocked) {
    signals.push({ id: "datacenter-block", label: "Bot protection (datacenter IP)", confidence: 0 })
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.re.test(haystack)) {
      signals.push({ id: pattern.id, label: pattern.label, confidence: 0 })
    }
  }

  for (const pattern of QUEUE_PATTERNS) {
    if (pattern.re.test(haystack)) {
      signals.push({ id: pattern.id, label: pattern.label, confidence: pattern.confidence })
    }
  }

  const queueSignals = signals.filter((s) => s.confidence > 0)
  const confidence = queueSignals.reduce((max, s) => Math.max(max, s.confidence), 0)
  const live = confidence >= 60

  return {
    live,
    confidence,
    signals,
    blocked: input.blocked ?? signals.some((s) => s.id === "datacenter-block" || s.id === "incapsula-block"),
    finalUrl: input.url,
    checkedAt,
  }
}

export async function checkPokemonCenterQueue(): Promise<QueueDetection> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch("https://www.pokemoncenter.com/", {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    })

    const html = await response.text()
    const blocked = /_Incapsula_Resource|incident_id=|Request unsuccessful/i.test(html)
    return detectQueueFromContent({
      html,
      url: response.url,
      blocked,
    })
  } catch {
    return detectQueueFromContent({ blocked: true })
  } finally {
    clearTimeout(timeout)
  }
}
