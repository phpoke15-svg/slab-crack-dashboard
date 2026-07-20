"use client"

import { useEffect, useState } from "react"
import type { CardSearchHit } from "@/lib/card-lookup"

type SearchResponse = {
  results?: CardSearchHit[]
  catalogReady?: boolean
  error?: string
}

const PRICE_CHUNK = 20

function hitsNeedPricing(hits: CardSearchHit[]): CardSearchHit[] {
  return hits.filter((hit) => !hit.rawPrice || hit.rawPrice <= 0)
}

export async function enrichCatalogSearchHits(
  hits: CardSearchHit[],
  signal: AbortSignal,
): Promise<CardSearchHit[]> {
  const unpriced = hitsNeedPricing(hits)
  if (unpriced.length === 0) return hits

  const priceById = new Map<string, number>()
  for (let i = 0; i < unpriced.length; i += PRICE_CHUNK) {
    if (signal.aborted) return hits

    const chunk = unpriced.slice(i, i + PRICE_CHUNK)
    const res = await fetch("/api/binder/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        cards: chunk.map((hit) => ({
          id: hit.id,
          name: hit.cardName,
          set: hit.setName,
          cardNumber: hit.cardNumber,
        })),
      }),
      signal,
    })

    if (!res.ok) continue

    const data = (await res.json()) as { prices?: Record<string, number> }
    for (const [id, price] of Object.entries(data.prices ?? {})) {
      if (price > 0) priceById.set(id, price)
    }
  }

  if (priceById.size === 0) return hits

  return hits.map((hit) => {
    const price = priceById.get(hit.id)
    return price && price > 0 ? { ...hit, rawPrice: price } : hit
  })
}

/** Shared catalog search for SlabCrack, SlabIt, Grade Check, and scan manual pickers. */
export function useCatalogCardSearch(query: string, enabled = true, debounceMs = 350) {
  const [hits, setHits] = useState<CardSearchHit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPricing, setIsPricing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setHits([])
      setIsLoading(false)
      setIsPricing(false)
      setError(null)
      return
    }

    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      setIsLoading(false)
      setIsPricing(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setIsPricing(false)
    setError(null)

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as SearchResponse
        if (!res.ok) throw new Error(data.error ?? "Search failed")

        const results = data.results ?? []
        if (controller.signal.aborted) return

        setHits(results)

        if (hitsNeedPricing(results).length > 0) {
          setIsPricing(true)
          try {
            const priced = await enrichCatalogSearchHits(results, controller.signal)
            if (!controller.signal.aborted) setHits(priced)
          } catch (e) {
            if ((e as Error).name !== "AbortError") {
              console.warn("[useCatalogCardSearch] price enrich failed:", e)
            }
          } finally {
            if (!controller.signal.aborted) setIsPricing(false)
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Search failed")
          setHits([])
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, debounceMs)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, enabled, debounceMs])

  return { hits, isLoading, isPricing, error }
}
