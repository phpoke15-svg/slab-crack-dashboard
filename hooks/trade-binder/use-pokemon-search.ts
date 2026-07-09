"use client"

import { useEffect, useState } from "react"
import type { CatalogCard } from "@/lib/trade-binder/cards"

export type BinderSearchResult = CatalogCard & { rawPrice?: number; cardNumber?: string }

type SearchResponse = {
  cards?: BinderSearchResult[]
  totalCount?: number
  featured?: boolean
}

function dedupeSearchResults<T extends { id: string }>(cards: T[]): T[] {
  const seen = new Set<string>()
  const unique: T[] = []
  for (const card of cards) {
    if (seen.has(card.id)) continue
    seen.add(card.id)
    unique.push(card)
  }
  return unique
}

async function fetchMissingPrices(cards: BinderSearchResult[]): Promise<BinderSearchResult[]> {
  const unpriced = cards
    .filter((card) => !card.rawPrice || card.rawPrice <= 0)
    .slice(0, 12)
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
  const [featured, setFeatured] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setResults([])
      setIsLoading(false)
      setError(null)
      setTotal(0)
      setFeatured(false)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    const timer = setTimeout(async () => {
      try {
        const q = query.trim()
        const params = new URLSearchParams({ pageSize: q.length >= 2 ? "40" : "30" })
        if (q.length >= 2) params.set("q", q)

        const res = await fetch(`/api/binder/search?${params.toString()}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as SearchResponse & { error?: string }
        if (!res.ok) throw new Error(data.error ?? "Search failed")

        const cards = dedupeSearchResults(data.cards ?? [])
        if (controller.signal.aborted) return

        setResults(cards)
        setTotal(data.totalCount ?? cards.length)
        setFeatured(Boolean(data.featured))

        void fetchMissingPrices(cards).then((priced) => {
          if (!controller.signal.aborted) setResults(dedupeSearchResults(priced))
        })
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          const message = e instanceof Error ? e.message : "Could not load cards. Try again."
          setError(message === "Search failed" ? "Could not load cards. Try again." : message)
          setResults([])
          setTotal(0)
          setFeatured(false)
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

  return { results, isLoading, error, total, featured }
}
