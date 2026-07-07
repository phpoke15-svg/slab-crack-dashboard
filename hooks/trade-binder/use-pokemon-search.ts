"use client"

import { useEffect, useState } from "react"
import type { CatalogCard } from "@/lib/trade-binder/cards"

export type BinderSearchResult = CatalogCard & { rawPrice?: number; cardNumber?: string }

type SearchResponse = {
  cards?: BinderSearchResult[]
  totalCount?: number
}

async function fetchMissingPrices(cards: BinderSearchResult[]): Promise<BinderSearchResult[]> {
  const unpriced = cards
    .filter((card) => !card.rawPrice || card.rawPrice <= 0)
    .slice(0, 24)
    .map((card) => ({
      id: card.id,
      name: card.name,
      set: card.set,
      cardNumber: card.cardNumber,
    }))

  if (unpriced.length === 0) return cards

  try {
    const res = await fetch("/api/binder/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cards: unpriced }),
    })
    if (!res.ok) return cards

    const data = (await res.json()) as { prices?: Record<string, number> }
    const prices = data.prices ?? {}
    if (Object.keys(prices).length === 0) return cards

    return cards.map((card) => {
      const price = prices[card.id]
      return price && price > 0 ? { ...card, rawPrice: price } : card
    })
  } catch {
    return cards
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

        const priced = await fetchMissingPrices(cards)
        if (!controller.signal.aborted) {
          setResults(priced)
        }
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
