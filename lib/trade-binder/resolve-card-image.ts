import type { CatalogCard } from "@/lib/trade-binder/cards"

function isPlaceholder(image?: string): boolean {
  if (!image?.trim()) return true
  if (image.includes("placeholder") || image.includes("placehold.co")) return true
  if (/\/(60|160)\.jpg(?:\?|$)/i.test(image)) return true
  return false
}

function parseNumberFromName(name: string): string {
  return name.match(/#(\d+[a-zA-Z/-]*)/)?.[1] ?? ""
}

export async function resolveCatalogCardImage(
  card: CatalogCard & { cardNumber?: string },
): Promise<CatalogCard> {
  if (!isPlaceholder(card.image)) return card

  const params = new URLSearchParams({
    id: card.id,
    name: card.name,
    set: card.set,
  })
  const number = card.cardNumber || parseNumberFromName(card.name)
  if (number) params.set("number", number)
  if (card.image && !isPlaceholder(card.image)) {
    params.set("imageUrl", card.image)
  }

  try {
    const res = await fetch(`/api/binder/card-image?${params.toString()}`)
    if (!res.ok) return card

    const data = (await res.json()) as { image?: string | null }
    return data.image ? { ...card, image: data.image } : card
  } catch {
    return card
  }
}
