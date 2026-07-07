"use client"

import { useEffect, useState } from "react"

const imageCache = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()

function isPlaceholder(image?: string): boolean {
  if (!image?.trim()) return true
  return image.includes("placeholder")
}

function parseNumberFromName(name: string): string {
  return name.match(/#(\d+[a-zA-Z/-]*)/)?.[1] ?? ""
}

async function fetchCardImage(input: {
  id: string
  name: string
  set: string
  cardNumber?: string
}): Promise<string | null> {
  const cached = imageCache.get(input.id)
  if (cached) return cached

  const pending = inflight.get(input.id)
  if (pending) return pending

  const promise = (async () => {
    const params = new URLSearchParams({
      id: input.id,
      name: input.name,
      set: input.set,
    })
    const number = input.cardNumber || parseNumberFromName(input.name)
    if (number) params.set("number", number)

    const res = await fetch(`/api/binder/card-image?${params.toString()}`)
    if (!res.ok) return null

    const data = (await res.json()) as { image?: string | null }
    if (data.image) {
      imageCache.set(input.id, data.image)
      return data.image
    }
    return null
  })()

  inflight.set(input.id, promise)
  try {
    return await promise
  } finally {
    inflight.delete(input.id)
  }
}

export function useCardImage(card: {
  id: string
  name: string
  set: string
  image: string
  cardNumber?: string
}): string {
  const [src, setSrc] = useState(() =>
    isPlaceholder(card.image) ? "/placeholder.svg" : card.image,
  )

  useEffect(() => {
    if (!isPlaceholder(card.image)) {
      setSrc(card.image)
      return
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
      cardNumber: card.cardNumber,
    }).then((image) => {
      if (cancelled || !image) return
      setSrc(image)
    })

    return () => {
      cancelled = true
    }
  }, [card.id, card.name, card.set, card.image, card.cardNumber])

  return src
}
