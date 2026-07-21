"use client"

import { useEffect, useState } from "react"
import type { CardSearchHit } from "@/lib/card-lookup"

type SearchResponse = {
  results?: CardSearchHit[]
  catalogReady?: boolean
  catalogSource?: string
  error?: string
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

        if (controller.signal.aborted) return
        setHits(data.results ?? [])
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
