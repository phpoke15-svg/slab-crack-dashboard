"use client"

import { useEffect, useState } from "react"
import type { PricedCatalogCard } from "@/lib/trade-binder/priced-catalog"

type SearchState = {
  results: PricedCatalogCard[]
  total: number
  isLoading: boolean
  error: string | null
}

export function usePricedCatalogSearch(query: string, enabled = true) {
  const [state, setState] = useState<SearchState>({
    results: [],
    total: 0,
    isLoading: false,
    error: null,
  })

  useEffect(() => {
    if (!enabled) {
      setState({ results: [], total: 0, isLoading: false, error: null })
      return
    }

    const controller = new AbortController()
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "80" })
        const q = query.trim()
        if (q) params.set("q", q)

        const res = await fetch(`/api/binder/priced-catalog?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error("Search failed")

        const data = (await res.json()) as {
          cards?: PricedCatalogCard[]
          total?: number
        }

        setState({
          results: data.cards ?? [],
          total: data.total ?? data.cards?.length ?? 0,
          isLoading: false,
          error: null,
        })
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        setState({
          results: [],
          total: 0,
          isLoading: false,
          error: "Could not load priced cards. Try again.",
        })
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, enabled])

  return state
}

export async function fetchAllPricedCatalogCards(): Promise<PricedCatalogCard[]> {
  const pageSize = 200
  let offset = 0
  let total = Infinity
  const all: PricedCatalogCard[] = []

  while (offset < total) {
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    })
    const res = await fetch(`/api/binder/priced-catalog?${params.toString()}`)
    if (!res.ok) throw new Error("Could not load priced catalog")

    const data = (await res.json()) as { cards?: PricedCatalogCard[]; total?: number }
    const page = data.cards ?? []
    total = data.total ?? page.length
    all.push(...page)
    if (page.length === 0) break
    offset += page.length
  }

  return all
}
