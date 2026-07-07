"use client"

import { useEffect, useState } from "react"
import type { CatalogCard } from "@/lib/trade-binder/cards"

export function usePokemonSearch(query: string, enabled = true) {
  const [results, setResults] = useState<CatalogCard[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (!enabled || q.length < 2) {
      setResults([])
      setIsLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/binder/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error("Search failed")
        const data = await res.json()
        setResults(data.cards ?? [])
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("Could not load cards. Try again.")
          setResults([])
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, enabled])

  return { results, isLoading, error }
}
