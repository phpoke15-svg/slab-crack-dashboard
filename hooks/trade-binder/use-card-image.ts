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

const MAX_CONCURRENT = 3

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

function hashDelay(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return hash % 1200
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
    await new Promise((resolve) => setTimeout(resolve, hashDelay(input.id)))

    const params = new URLSearchParams({
      id: input.id,
      name: input.name,
      set: input.set,
    })
    const number = input.cardNumber || parseNumberFromName(input.name)
    if (number) params.set("number", number)
    if (input.image && !isPlaceholderCardImage(input.image)) {
      params.set("imageUrl", input.image)
    }

    const res = await fetch(`/api/binder/card-image?${params.toString()}`)
    if (!res.ok) return null

    const data = (await res.json()) as { image?: string | null }
    if (data.image) {
      imageCache.set(input.id, data.image)
      return data.image
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
  const fallbackSrc = bestDisplayCardImageUrl(card.image)
  const [src, setSrc] = useState(fallbackSrc)

  useEffect(() => {
    setSrc(fallbackSrc)

    if (!upgrade || !cardImageNeedsUpgrade(card.image)) return

    const synced = upgradeCardImageUrlSync(card.image)
    if (synced !== card.image) {
      setSrc(synced)
    }

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
  }, [card.id, card.name, card.set, card.image, card.cardNumber, fallbackSrc, upgrade])

  return src
}
