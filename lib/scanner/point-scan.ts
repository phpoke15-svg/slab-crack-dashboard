"use client"

/** Soft haptic when a live scan match lands (mobile browsers). */
export function scanHapticMatch(): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return
  try {
    navigator.vibrate([10, 35, 10])
  } catch {
    /* ignored */
  }
}
