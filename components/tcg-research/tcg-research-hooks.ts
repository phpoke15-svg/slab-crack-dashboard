"use client"

import { useEffect, useState } from "react"
import type { CardSearchHit } from "@/lib/card-lookup"
import type { TcgGame } from "@/lib/scrydex/types"
import { fetchErrorMessage, readResponseJson } from "@/lib/fetch-json"

export function useTcgResearchPopular(game: TcgGame) {
  const [hits, setHits] = useState<CardSearchHit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    void (async () => {
      try {
        const params = new URLSearchParams({ game, limit: "100" })
        const res = await fetch(`/api/tcg-research/popular?${params.toString()}`, {
          signal: controller.signal,
        })
        const json = await readResponseJson<{ results?: CardSearchHit[]; error?: string }>(res)
        if (!json || !res.ok) throw new Error(fetchErrorMessage(res, json, "Could not load popular cards"))
        setHits(json.results ?? [])
      } catch (err) {
        if (controller.signal.aborted) return
        setHits([])
        setError(err instanceof Error ? err.message : "Could not load popular cards")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    })()

    return () => controller.abort()
  }, [game])

  return { hits, isLoading, error }
}

export function useTcgResearchSearch(query: string, game: TcgGame, enabled: boolean) {
  const [hits, setHits] = useState<CardSearchHit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || query.trim().length < 2) {
      setHits([])
      setError(null)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ q: query.trim(), game })
        const res = await fetch(`/api/tcg-research/search?${params.toString()}`, {
          signal: controller.signal,
        })
        const json = await readResponseJson<{ results?: CardSearchHit[]; error?: string }>(res)
        if (!json || !res.ok) throw new Error(fetchErrorMessage(res, json, "Search failed"))
        setHits(json.results ?? [])
      } catch (err) {
        if (controller.signal.aborted) return
        setHits([])
        setError(err instanceof Error ? err.message : "Search failed")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [enabled, game, query])

  return { hits, isLoading, error }
}

export const TCG_RESEARCH_GAME_TABS: { id: TcgGame; label: string }[] = [
  { id: "pokemon", label: "Pokémon" },
  { id: "lorcana", label: "Lorcana" },
  { id: "mtg", label: "MTG" },
]
