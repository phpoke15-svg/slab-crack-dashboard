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
}

const QUEUE_PATTERNS: Array<{ id: string; label: string; confidence: number; re: RegExp }> = [
  { id: "queue-it-net", label: "Queue-it domain", confidence: 100, re: /queue-it\.net/i },
  { id: "queue-it-js", label: "Queue-it script", confidence: 90, re: /queue-it\.js|queueit/i },
  { id: "waiting-room-url", label: "Waiting room URL", confidence: 100, re: /waitingroom|waiting-room/i },
  { id: "virtual-queue", label: "Virtual queue copy", confidence: 70, re: /virtual queue|waiting room/i },
  { id: "hi-trainer", label: "Queue greeting", confidence: 60, re: /hi,?\s*trainer/i },
  { id: "incapsula-queue", label: "Queue position payload", confidence: 90, re: /"pos"\s*:\s*\d+[\s\S]{0,200}"pending"\s*:\s*1/i },
  { id: "queue-countdown", label: "Queue countdown", confidence: 50, re: /\b\d{1,2}:\d{2}:\d{2}\b[\s\S]{0,80}(?:queue|wait)/i },
]

const BLOCKED_PATTERNS = [
  { id: "incapsula-block", label: "Imperva challenge", re: /_Incapsula_Resource|incident_id=/i },
  { id: "access-denied", label: "Access denied", re: /access denied|request unsuccessful/i },
]

const MOBILE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"

export function detectQueueFromContent(input: { html?: string; url?: string }): QueueDetection {
  const haystack = `${input.url ?? ""}\n${input.html ?? ""}`
  const signals: QueueSignal[] = []

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

  return {
    live: confidence >= 60,
    confidence,
    signals: queueSignals,
    blocked: signals.some((s) => s.confidence === 0),
  }
}

export async function checkPokemonCenterQueue(): Promise<QueueDetection & { url?: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const response = await fetch("https://www.pokemoncenter.com/", {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": MOBILE_USER_AGENT,
        "Cache-Control": "no-cache",
      },
    })

    const html = await response.text()
    const result = detectQueueFromContent({ html, url: response.url })
    return { ...result, url: response.url }
  } catch {
    return { ...detectQueueFromContent({}), blocked: true }
  } finally {
    clearTimeout(timeout)
  }
}
