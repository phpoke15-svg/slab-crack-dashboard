"use client"

import { useEffect, useState } from "react"
import { fetchErrorMessage, readResponseJson } from "@/lib/fetch-json"
import type { ScrydexGradedPrice } from "@/lib/grading/quotes"
import type { TcgResearchCardFull } from "@/lib/tcg-research/card-full"
import type { TcgGame } from "@/lib/scrydex/types"

type CacheEntry = {
  promise?: Promise<TcgResearchCardFull | null>
  data?: TcgResearchCardFull | null
}

const cache = new Map<string, CacheEntry>()

async function fetchScrydexCardPricing(cardId: string): Promise<TcgResearchCardFull | null> {
  const existing = cache.get(cardId)
  if (existing?.data) return existing.data
  if (existing?.promise) return existing.promise

  const promise = (async () => {
    const params = new URLSearchParams({ id: cardId })
    const res = await fetch(`/api/tcg-research/card?${params.toString()}`)
    const json = await readResponseJson<TcgResearchCardFull & { error?: string }>(res)
    if (!json || !res.ok || !json.card) return null
    cache.set(cardId, { data: json })
    return json
  })()

  cache.set(cardId, { promise })
  try {
    const data = await promise
    cache.set(cardId, { data })
    return data
  } catch {
    cache.delete(cardId)
    return null
  }
}

export function useScrydexCardPricing(cardId: string | null | undefined, enabled = true) {
  const [payload, setPayload] = useState<TcgResearchCardFull | null>(() => {
    if (!cardId) return null
    return cache.get(cardId)?.data ?? null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !cardId) {
      setPayload(null)
      setLoading(false)
      setError(null)
      return
    }

    const cached = cache.get(cardId)?.data
    if (cached) {
      setPayload(cached)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void fetchScrydexCardPricing(cardId)
      .then((data) => {
        if (cancelled) return
        setPayload(data)
        if (!data) {
          setError("Could not load Scrydex prices")
        }
      })
      .catch((fetchError) => {
        if (cancelled) return
        setPayload(null)
        setError(fetchError instanceof Error ? fetchError.message : "Could not load Scrydex prices")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [cardId, enabled])

  return {
    payload,
    gradedPrices: payload?.gradedPrices as ScrydexGradedPrice[] | undefined,
    catalogId: payload?.catalogId ?? null,
    scrydexId: payload?.scrydexId ?? null,
    game: (payload?.game ?? "pokemon") as TcgGame,
    loading,
    error,
  }
}
