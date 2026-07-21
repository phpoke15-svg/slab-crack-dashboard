"use client"

import { useEffect, useRef, useState } from "react"

type UsePriceFlashOptions = {
  durationMs?: number
  /** When set, also flash when this refresh token changes (e.g. price_updated_at). */
  refreshTrigger?: string | null
}

export function usePriceFlash(price: number, options: UsePriceFlashOptions = {}) {
  const { durationMs = 1000, refreshTrigger } = options
  const prevPriceRef = useRef<number | null>(null)
  const prevTriggerRef = useRef<string | null | undefined>(undefined)
  const [flashing, setFlashing] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const priceChanged =
      prevPriceRef.current != null && prevPriceRef.current !== price && price > 0
    const triggerChanged =
      refreshTrigger != null &&
      prevTriggerRef.current != null &&
      prevTriggerRef.current !== refreshTrigger

    if (priceChanged || triggerChanged) {
      setFlashing(true)
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        setFlashing(false)
        timerRef.current = null
      }, durationMs)
    }

    prevPriceRef.current = price
    if (refreshTrigger != null) prevTriggerRef.current = refreshTrigger

    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [durationMs, price, refreshTrigger])

  return flashing
}
