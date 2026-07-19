/**
 * POP REPORT NON-LINEAR SCALE
 * ===========================
 * Population counts are heavily skewed toward low numbers (most grades have
 * small pops). A linear 1–10,000 slider would cram 1–500 into ~5% of the track.
 *
 * We map slider position `t` ∈ [0, 1] to pop count through PIECEWISE segments.
 * Each segment linearly interpolates in **log(pop)** space so the thumb moves
 * slowly across rare low pops and faster across high pops.
 *
 * To tune feel later:
 * - Move a breakpoint's `t` left/right → give that pop range more/less track.
 * - Change `pop` at a breakpoint → change the value at that position.
 * - Add/remove rows → add/remove scale regions (keep `t` sorted 0 → 1).
 */
export const POP_SCALE_BREAKPOINTS = [
  { t: 0, pop: 1 },
  { t: 0.12, pop: 10 },
  { t: 0.22, pop: 25 },
  { t: 0.32, pop: 50 },
  { t: 0.4, pop: 100 },
  { t: 0.48, pop: 200 },
  { t: 0.55, pop: 350 },
  { t: 0.62, pop: 500 },
  { t: 0.7, pop: 750 },
  { t: 0.77, pop: 1000 },
  { t: 0.84, pop: 2000 },
  { t: 0.9, pop: 3500 },
  { t: 0.95, pop: 5000 },
  { t: 0.98, pop: 7500 },
  { t: 1, pop: 10_000 },
] as const

export const POP_MIN = POP_SCALE_BREAKPOINTS[0].pop
export const POP_MAX = POP_SCALE_BREAKPOINTS[POP_SCALE_BREAKPOINTS.length - 1].pop

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function logLerp(a: number, b: number, fraction: number): number {
  if (a <= 0 || b <= 0) return a + (b - a) * fraction
  const logA = Math.log(a)
  const logB = Math.log(b)
  return Math.exp(logA + (logB - logA) * fraction)
}

/** Map normalized slider position (0–1) → pop count. */
export function popFromPosition(position: number): number {
  const t = clamp(position, 0, 1)

  for (let i = 1; i < POP_SCALE_BREAKPOINTS.length; i++) {
    const prev = POP_SCALE_BREAKPOINTS[i - 1]
    const next = POP_SCALE_BREAKPOINTS[i]
    if (t <= next.t) {
      const span = next.t - prev.t
      const fraction = span === 0 ? 0 : (t - prev.t) / span
      return Math.round(logLerp(prev.pop, next.pop, fraction))
    }
  }

  return POP_MAX
}

/** Map pop count → normalized slider position (0–1). Inverse of popFromPosition. */
export function positionFromPop(pop: number): number {
  const value = clamp(pop, POP_MIN, POP_MAX)

  for (let i = 1; i < POP_SCALE_BREAKPOINTS.length; i++) {
    const prev = POP_SCALE_BREAKPOINTS[i - 1]
    const next = POP_SCALE_BREAKPOINTS[i]
    if (value <= next.pop) {
      const span = next.pop - prev.pop
      let fraction = 0
      if (span > 0) {
        if (prev.pop <= 0 || next.pop <= 0) {
          fraction = (value - prev.pop) / span
        } else {
          const logPrev = Math.log(prev.pop)
          const logNext = Math.log(next.pop)
          fraction = (Math.log(value) - logPrev) / (logNext - logPrev)
        }
      }
      const tSpan = next.t - prev.t
      return prev.t + fraction * tSpan
    }
  }

  return 1
}

/** Human-readable label for pop ceiling values. */
export function formatPopLabel(pop: number): string {
  if (pop >= POP_MAX) return "10,000+"
  if (pop <= 1) return "1"
  return pop.toLocaleString("en-US")
}
