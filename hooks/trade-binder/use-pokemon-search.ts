"use client"

import { useEffect, useState } from "react"
import type { CatalogCard } from "@/lib/trade-binder/cards"

export type BinderSearchResult = CatalogCard & { rawPrice?: number }

type SearchResponse = {
  cards?: BinderSearchResult[]
  totalCount?: number
}

export function usePokemonSearch(query: string, enabled = true) {
  const [results, setResults] = useState<BinderSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setResults([])
      setIsLoading(false)
      setError(null)
      setTotal(0)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    const timer = setTimeout(async () => {
      try {
        const q = query.trim()
        const params = new URLSearchParams({ pageSize: "80" })
        if (q) params.set("q", q)

        const res = await fetch(`/api/binder/search?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error("Search failed")

        const data = (await res.json()) as SearchResponse
        const cards = data.cards ?? []
        setResults(cards)
        setTotal(data.totalCount ?? cards.length)
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("Could not load cards. Try again.")
          setResults([])
          setTotal(0)
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, enabled])

  return { results, isLoading, error, total }
}
