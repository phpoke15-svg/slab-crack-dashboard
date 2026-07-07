"use client"

import { useEffect, useState } from "react"
import type { CatalogCard } from "@/lib/trade-binder/cards"
import type { PricedCatalogCard } from "@/lib/trade-binder/priced-catalog"

export type BinderSearchResult = CatalogCard & { rawPrice?: number }

function pricedToCatalog(card: PricedCatalogCard): BinderSearchResult {
  return {
    id: card.id,
    name: card.name,
    set: card.set,
    rarity: card.rarity,
    image: card.image,
    rawPrice: card.rawPrice,
  }
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
        const params = new URLSearchParams({ limit: "80" })
        if (q.length >= 1) params.set("q", q)

        const res = await fetch(`/api/binder/priced-catalog?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error("Search failed")

        const data = await res.json()
        const cards = (data.cards ?? []) as PricedCatalogCard[]
        setResults(cards.map(pricedToCatalog))
        setTotal(data.total ?? cards.length)
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
