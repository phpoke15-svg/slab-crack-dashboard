import { config } from "./config.js"
import type { HeadProbeResult } from "./queue-detector.js"

export type PokemonCenterProbeResult = HeadProbeResult & {
  transport: "playwright-stealth"
  profile: string
  title?: string | null
}

export function formatProbeLogLine(probe: PokemonCenterProbeResult): string {
  const blockedNote = probe.blocked ? " blocked=Imperva" : ""
  const titleNote = probe.title ? ` title="${probe.title.slice(0, 60)}"` : ""
  return (
    `[worker] NAV ${config.targetUrl} -> ${probe.status} transport=${probe.transport} profile=${probe.profile}` +
    (probe.location ? ` location=${probe.location}` : "") +
    titleNote +
    (probe.live ? " LIVE" : "") +
    blockedNote
  )
}

export function formatProbeError(error: unknown): string {
  if (error instanceof Error) {
    const code = "code" in error ? String((error as NodeJS.ErrnoException).code) : ""
    return code ? `${error.message} (${code})` : error.message
  }
  return String(error)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
