"use client"

import { useEffect, useState } from "react"
import {
  bestDisplayCardImageUrl,
  cardImageNeedsUpgrade,
  isPlaceholderCardImage,
  upgradeCardImageUrlSync,
} from "@/lib/card-image-url"

const imageCache = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()
let activeRequests = 0
const requestQueue: Array<() => void> = []

const MAX_CONCURRENT = 6

function runWithQueue<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeRequests += 1
      task()
        .then(resolve, reject)
        .finally(() => {
          activeRequests -= 1
          requestQueue.shift()?.()
        })
    }

    if (activeRequests < MAX_CONCURRENT) run()
    else requestQueue.push(run)
  })
}

export function isMissingCardImage(image?: string): boolean {
  return isPlaceholderCardImage(image)
}

export function shouldUpgradeCardImage(image?: string): boolean {
  return cardImageNeedsUpgrade(image)
}

function parseNumberFromName(name: string): string {
  return name.match(/#(\d+[a-zA-Z/-]*)/)?.[1] ?? ""
}

function cardNumberFromId(id: string): string {
  if (id.startsWith("pc-") || id.startsWith("poke-")) return ""
  const match = id.match(/-(\d+[a-z]?)$/i)
  return match?.[1] ?? ""
}

function resolveDisplayImage(image: string): string {
  return bestDisplayCardImageUrl(image)
}

async function fetchCardImage(input: {
  id: string
  name: string
  set: string
  image: string
  cardNumber?: string
}): Promise<string | null> {
  const cached = imageCache.get(input.id)
  if (cached) return cached

  const pending = inflight.get(input.id)
  if (pending) return pending

  const promise = runWithQueue(async () => {
    const params = new URLSearchParams({
      id: input.id,
      name: input.name,
      set: input.set,
    })
    const number = input.cardNumber || parseNumberFromName(input.name) || cardNumberFromId(input.id)
    if (number) params.set("number", number)
    if (input.image && !isPlaceholderCardImage(input.image)) {
      params.set("imageUrl", input.image)
    }

    const res = await fetch(`/api/binder/card-image?${params.toString()}`)
    if (!res.ok) return null

    const data = (await res.json()) as { image?: string | null }
    if (data.image) {
      const upgraded = upgradeCardImageUrlSync(data.image)
      imageCache.set(input.id, upgraded)
      return upgraded
    }
    return null
  })

  inflight.set(input.id, promise)
  try {
    return await promise
  } finally {
    inflight.delete(input.id)
  }
}

export function useCardImage(
  card: {
    id: string
    name: string
    set: string
    image: string
    cardNumber?: string
  },
  options?: { upgrade?: boolean },
): string {
  const upgrade = options?.upgrade ?? true
  const fallbackSrc = resolveDisplayImage(card.image)
  const [src, setSrc] = useState(fallbackSrc)

  useEffect(() => {
    const display = resolveDisplayImage(card.image)
    setSrc(display)

    if (!upgrade) return

    const needsFetch =
      cardImageNeedsUpgrade(display) ||
      card.id.startsWith("pc-") ||
      (card.id.includes("-") && !card.id.startsWith("pc-") && !card.id.startsWith("poke-"))

    if (!needsFetch) return

    const cached = imageCache.get(card.id)
    if (cached) {
      setSrc(cached)
      return
    }

    let cancelled = false

    fetchCardImage({
      id: card.id,
      name: card.name,
      set: card.set,
      image: card.image,
      cardNumber: card.cardNumber,
    }).then((image) => {
      if (cancelled || !image) return
      setSrc(image)
    })

    return () => {
      cancelled = true
    }
  }, [card.id, card.name, card.set, card.image, card.cardNumber, upgrade])

  return src
}
